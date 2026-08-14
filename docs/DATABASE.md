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

### Product — **implemented in Phase 3**
```
Product {
  _id
  vendor           ref → User (indexed) — see note below
  category         ref → Category (indexed)
  title, description, slug (unique, indexed)
  variants         [ { sku (globally unique, indexed), attributes, price, compareAtPrice, stock, reservedStock } ]
  images           [ { url, alt } ]
  status           enum: draft | active | archived
  priceRange       { min, max }              // denormalized, recomputed on every variant change
  ratingAverage, ratingCount
  createdAt / updatedAt
}
```
Indexes: `{ vendor: 1, status: 1 }` (vendor's own product list), `{ category: 1, status: 1 }` (category browsing), `{ status: 1, 'priceRange.min': 1 }` (storefront price sort), text index on `{ title, description }` (search), unique index on `variants.sku` (global SKU uniqueness — a unique index on an array field path is multikey in Mongo, so this is enforced across every document, not just within one product).

Two decisions worth calling out from actually building it:

- **`vendor` references `User`, not `Vendor`.** The dedicated `Vendor`
  collection (storefront metadata, approval status, payout details) isn't
  built until Phase 4 — building Product in Phase 3 meant either blocking
  on Phase 4 or pointing at what exists today (`User`, since every vendor
  already has one from Phase 2's registration flow). Every vendor-scoping
  check compares this field against `req.user.id`, so repointing it at
  `Vendor._id` in Phase 4 is planned to be a one-line service change, not
  a data migration — `Vendor.user` will stay a 1:1 pointer back to the
  same `User`.
- **`priceRange.{min,max}` is denormalized**, recomputed by
  `productService.recomputePriceRange` on every create/update/variant
  mutation. Sorting or filtering a storefront listing by price without
  this would mean unwinding the `variants` array on every query — cheap
  to keep in sync, expensive to compute on the fly at listing scale.
- **`reservedStock` exists on every variant now, always `0`.** Nothing
  writes to it yet — checkout doesn't exist until Phase 6/7. Defining the
  field now means Phase 7 doesn't need a migration touching every
  existing product to add it. `availableStock` (`stock - reservedStock`)
  is a Mongoose virtual, never stored, so it can't drift from its inputs.

### Category — **implemented in Phase 3**
```
Category {
  _id
  name, slug (unique, indexed)
  description
  parent           ref → Category | null    // self-referencing, enables subcategories
  image            { url, alt }
  isActive
  createdAt / updatedAt
}
```
Self-referencing `parent` gives one collection both top-level categories
and subcategories without a separate model. Kept flat (not a nested
embedded tree) so categories can be queried/paginated/moderated like any
other collection — the tree shape needed for storefront navigation is
assembled from a flat list in the service layer, which is cheap at
marketplace-category scale (tens to a few hundred documents). Deleting a
category is blocked (`409`) if it still has subcategories or products,
rather than cascading — an accidental delete shouldn't silently orphan a
product's category reference. Reassigning a category's `parent` runs a
cycle check (`categoryService.assertNoCycle`) that walks the proposed
parent's ancestor chain — a category can never become its own, direct or
transitive, ancestor.

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
Stock lives on `Product.variants[].stock` for simple reads, with a
`reservedStock` counterpart already on the same subdocument (added in
Phase 3, held at `0` until Phase 6/7 checkout writes to it — see the
Product section above). A companion **`InventoryLedger`** collection
(separate, append-only, Phase 7) will record every stock change
(`reserve`, `release`, `adjust`, `sale`) — the audit trail a real
e-commerce system needs to explain "why does this SKU show 4 units" is a
query problem, not something that belongs on the product document itself.

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
