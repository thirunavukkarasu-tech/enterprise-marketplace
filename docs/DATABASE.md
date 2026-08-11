# Database Design — MarketSphere

MongoDB via Mongoose. Schemas below are the Phase 1 design decisions —
models themselves are implemented as each phase needs them, not all at
once, but the shape is decided now so later phases don't require
migrations of data that doesn't exist yet.

## 1. Embed vs. reference — the actual rule being applied

> Embed data that is **read together, owned by one parent, and doesn't
> need to be queried independently.** Reference data that is **shared
> across parents, grows unboundedly, or is queried/reported on by
> itself.**

| Data | Decision | Why |
|---|---|---|
| Order → Order Items | **Embedded** | An order's line items are only ever read as part of that order, never queried across orders directly, and are immutable once placed (price/qty snapshot at purchase time). |
| Order → Customer, Vendor(s) | **Referenced** | A customer and vendor each have their own lifecycle and are queried independently of any single order (e.g. "all orders for vendor X"). |
| Product → Variants (size/color/SKU) | **Embedded** | Variants are meaningless outside their parent product and are always fetched together with it. |
| Product → Category | **Referenced** | Categories are shared across thousands of products and are managed/queried independently (admin CRUD, category-page listing). |
| Product → Vendor | **Referenced** | A vendor owns many products; products must be queryable per-vendor and vendor data (name, rating) is reused across many products — embedding would duplicate and go stale. |
| Vendor → Documents (KYC uploads) | **Embedded** | Small, bounded array, only relevant in the context of that vendor's approval record. |
| Cart → Cart Items | **Embedded** | Same reasoning as order items, but mutable — read/written as a unit on every cart change. |
| Review → Product, Customer | **Referenced** | Reviews are queried both "by product" and "by customer," and must not duplicate product/customer data that changes independently. |
| Inventory history | **Referenced, separate collection** | Append-only, grows unboundedly, and is queried by date range/product independently of the product document itself — embedding would blow past MongoDB's 16MB document limit over time. |
| Audit log entries | **Referenced, separate collection** | Same reasoning: unbounded, time-series, queried independently by actor/action/date. |

## 2. Core collections (Phase 1 design)

### User
```
User {
  _id
  name
  email            (unique, indexed)
  passwordHash
  role             enum: super_admin | vendor | customer | delivery_partner
  isEmailVerified  boolean
  isActive         boolean
  refreshTokenVersion  number   // incremented on logout/reuse-detection
  createdAt / updatedAt
}
```
`role` is a single field, not a separate roles collection — a user has
exactly one role in this domain (a vendor's staff accounts are a Phase 4+
concern, out of scope for the core model). Indexed on `email` (unique) and
`role` (compound with `isActive` for admin user-management queries).

### Vendor
```
Vendor {
  _id
  user             ref → User (1:1, indexed, unique)
  storeName
  status           enum: pending | approved | rejected | suspended
  documents        [ { type, url, uploadedAt } ]   // embedded, bounded
  payoutDetails    { ... }
  ratingAverage
  ratingCount
  createdAt / updatedAt
}
```
Separate from `User` (rather than fields on User) because vendor status,
documents, and payout details are meaningless for the other three roles —
keeping them apart avoids a User schema full of nullable vendor-only
fields.

### Product
```
Product {
  _id
  vendor           ref → Vendor (indexed)
  category         ref → Category (indexed)
  title, description, slug (unique, indexed)
  variants         [ { sku (unique, indexed), attributes, price, compareAtPrice, stock } ]
  images           [ { url, alt } ]
  status           enum: draft | active | archived
  ratingAverage, ratingCount
  createdAt / updatedAt
}
```
Compound index on `{ vendor: 1, status: 1 }` (vendor's product list),
text index on `{ title, description }` (search), index on `slug`.

### Order
```
Order {
  _id
  orderNumber      (unique, indexed, human-readable)
  customer         ref → User (indexed)
  vendorGroups     [ {                       // one entry per vendor in a multi-vendor cart
      vendor         ref → Vendor
      items          [ { product ref, variantSku, title, qty, unitPrice } ]  // embedded snapshot
      subtotal
      status         enum: pending | confirmed | shipped | delivered | cancelled | returned
  } ]
  shippingAddress  { ... }                    // embedded snapshot at order time
  paymentStatus    enum: pending | paid | failed | refunded
  grandTotal
  createdAt / updatedAt
}
```
This is the one deliberately non-obvious decision: a **single order
document contains a `vendorGroups` array**, one entry per vendor in that
checkout, rather than splitting into N separate Order documents per
vendor. The customer experience ("my orders") needs the whole checkout as
one unit; vendor-side queries ("this vendor's orders") filter into
`vendorGroups` with an aggregation `$unwind` on `vendorGroups` matched to
`vendor`. This avoids duplicating shared fields (customer, shipping
address, payment) across N documents while still letting each vendor's
portion move through its own status lifecycle independently.
Order items are embedded as **price/title snapshots**, not live references
— an order must show what was actually charged even if the product is
later repriced or deleted.

### Cart
```
Cart {
  _id
  customer   ref → User (unique, indexed)
  items      [ { product ref, variantSku, qty } ]   // embedded, mutable
  updatedAt
}
```

### Inventory
Stock lives on the `Product.variants[].stock` field for simple reads, with
a companion **`InventoryLedger`** collection (separate, append-only) for
every stock change (`reserve`, `release`, `adjust`, `sale`) — the audit
trail a real e-commerce system needs to explain "why does this SKU show 4
units" is a query problem, not something that belongs on the product
document itself.

### Coupon
```
Coupon {
  _id
  code            (unique, indexed)
  vendor          ref → Vendor | null   // null = platform-wide coupon
  discountType    enum: percentage | fixed
  discountValue
  minOrderAmount
  usageLimit, usageCount
  expiresAt
}
```

### Review
```
Review {
  _id
  product   ref → Product (indexed)
  customer  ref → User (indexed)
  order     ref → Order            // proves verified purchase
  rating, comment
  isVerifiedPurchase   boolean
  moderationStatus     enum: pending | approved | rejected
}
```
Compound unique index on `{ product, customer, order }` — one review per
purchase, not per product, so a customer who buys the same item twice can
leave two honest reviews.

### AuditLog
```
AuditLog {
  _id
  actor        ref → User
  action       string   // 'vendor.approved', 'order.refunded', 'role.changed', ...
  targetType, targetId
  metadata     Mixed
  createdAt
}
```
Append-only, indexed on `{ actor, createdAt }` and `{ action, createdAt }`
for the two ways this actually gets queried (by admin, by action type).

## 3. Indexing philosophy

Every index above exists because a specific screen or query needs it —
"vendor's product list," "search by title," "orders by customer," "audit
log by actor." No index is added speculatively; unused indexes cost write
performance for no read benefit, which matters more once the product
catalog and order volume grow past demo-data size.
