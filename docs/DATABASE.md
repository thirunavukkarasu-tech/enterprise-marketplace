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
| Vendor → KYC documents | **Deferred** | Planned as an embedded, bounded array when built — but Phase 4 shipped without it; there's no file-upload infrastructure yet for any domain to attach to. See the Vendor section below. |
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
  phone            optional — added in Phase 5 for the account profile page
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
`phone` is optional and unindexed — it didn't exist through registration
in Phase 2, so every pre-Phase-5 account would otherwise start in a
permanently-invalid state if it were required.

### Vendor — **implemented in Phase 4**
```
Vendor {
  _id
  user               ref → User (1:1, unique)
  storeName, legalBusinessName, description
  businessEmail, businessPhone
  address            { line1, line2, city, state, country, postalCode }  // embedded sub-schema
  taxId
  logo, banner       { url, alt }
  status             enum: pending | approved | rejected | suspended
  isVerified, verifiedAt, verifiedBy
  reviewedBy, reviewedAt, rejectionReason, suspensionReason
  createdAt / updatedAt
}
```
Indexes: `status`, `isVerified`, `businessEmail`, `createdAt` (descending, for the admin list's default newest-first sort), text index on `{ storeName, legalBusinessName, businessEmail }` (admin search). `user` gets its unique index from the field-level `unique: true` — no separate `schema.index()` call for it (see the Phase 2 postmortem on duplicate-index warnings, which this project keeps re-applying rather than re-learning).

Decisions worth calling out:

- **`address` is a real sub-schema, not a plain object** — self-contained
  validation (required line1/city/state/country/postalCode) that's
  reusable if another domain ever needs a postal address shape (e.g. a
  delivery pickup address in a later phase), rather than duplicating the
  same five `required` rules inline.
- **`status` and `isVerified` are two independent fields, not one.**
  `status` governs whether the vendor may sell at all (the
  pending/approved/rejected/suspended lifecycle below). `isVerified` is a
  separate "business documents checked" signal an admin can set
  regardless of status — verifiable while still pending, and not
  automatically revoked on suspension, since a suspension doesn't
  retroactively make previously-checked business information fraudulent.
  Collapsing these into one field would force a choice between "verified
  vendors are always approved" (wrong — verification can happen first)
  or "approval implies verification" (also wrong — an admin might
  approve based on the application alone and verify documents later).
- **`documents` (KYC uploads) from the original Phase 1 speculative
  design is deferred, not built.** Phase 4 has no file-upload
  infrastructure yet (that's a Phase 3/4-adjacent concern — Cloudinary/S3
  abstraction — not yet wired to any domain). `logo`/`banner` use the
  same `{url, alt}` shape a future document-upload feature would reuse.
- **`payoutDetails` from the original speculative design is deferred.**
  Nothing pays a vendor out until Phase 7 has real orders and Phase 7's
  payment abstraction exists — defining a payout schema now would be
  guessing at a shape with no consumer to validate it against.

### Vendor ↔ Product relationship — **why `Product.vendor` still points at `User`, not `Vendor`**

Phase 3's design note on this page originally floated repointing
`Product.vendor` to `Vendor._id` once Phase 4 built the Vendor
collection. Having now built it, the repoint turned out to add no
guarantee that didn't already exist:

- `Vendor.user` is a unique 1:1 pointer to the same `User` document
  `Product.vendor` already references — every vendor-owned product is
  already reliably attributable to exactly one vendor profile via that
  relationship.
- Every ownership check (`canManageProduct`) and every scoping query
  (`productService.listManaged`, the vendor dashboard's product counts)
  already works correctly comparing against `req.user.id` — a `User` id
  is just as unique and just as reliable a foreign key as a `Vendor` id
  would be here.
- Repointing would touch Product's schema, every product query, and
  every ownership check across tested, approved Phase 3 code — for zero
  new capability. That's pure churn, not a fix, and the project's stated
  rule is not to refactor a completed phase without a genuine dependency
  issue forcing it.

The vendor dashboard's product counts (`Product.countDocuments({ vendor:
userId })`) and the admin's `GET /products/manage?vendor=<id>` filter
both key off this same `User` id — no join between Product and Vendor is
needed for either. If a future phase ever needs to query "all products
for vendor profile X" starting from a `Vendor` document rather than a
`User`, `Vendor.user` → `Product.vendor` is a single equality lookup, not
a schema change.

### Product — **implemented in Phase 3**
```
Product {
  _id
  vendor           ref → User (indexed) — see the Vendor section above for why not Vendor._id
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

Two other decisions worth calling out from actually building it:

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

### Order — **implemented in Phase 7**
```
Order {
  _id
  orderNumber      (unique, human-readable, e.g. "ORD-20260901-4F2A")
  customer         ref → User (indexed)
  vendorGroups     [ {                       // one entry per vendor in the checkout that created this order
      vendor         ref → User               // see the Vendor ↔ Product section above — same convention
      items          [ { product ref, sku, title, quantity, unitPrice, lineSubtotal } ]  // embedded snapshot
      subtotal
      status         enum: pending | confirmed | processing | shipped | delivered | cancelled | refunded
  } ]
  shippingAddress, billingAddress  { ... }    // embedded snapshots at order time
  shippingMethod, subtotal, discountAmount, taxAmount, shippingFee, grandTotal
  paymentStatus    enum: pending   // no gateway exists yet — see docs/ARCHITECTURE.md §7
  createdAt / updatedAt
}
```
Indexed on `{ customer, createdAt }`, `{ 'vendorGroups.vendor', createdAt }`, and `{ 'vendorGroups.status' }` — the three ways this is actually queried ("my orders," "orders containing my products," "orders in status X").

This is the one deliberately non-obvious decision, decided back in Phase 1 and now built exactly as planned: a **single order document contains a `vendorGroups` array**, one entry per vendor in that checkout, rather than splitting into N separate Order documents per vendor. The customer experience ("my orders") needs the whole checkout as one unit; vendor-side queries ("this vendor's orders") aggregate-`$unwind` on `vendorGroups` matched to `vendor`. This avoids duplicating shared fields (customer, shipping address, payment) across N documents while still letting each vendor's portion move through its own status lifecycle independently — one vendor group can be `shipped` while another on the same order is still `processing`.

Order items are embedded as **price/title snapshots**, not live references — an order must show what was actually charged even if the product is later repriced or deleted. Unlike Cart's `priceSnapshot` (display-only, always re-priced live), an Order's `unitPrice` genuinely is what was charged, forever — nothing ever re-reads live product data for an existing order.

**`vendor` references `User`, not `Vendor`** — same reasoning as `Product.vendor` (see above): introducing a second FK convention for orders alone would be inconsistent for no benefit, since `Vendor.user` already provides the reliable 1:1 relationship every vendor-scoped order query needs.

**`vendorGroups[].status` uses the full operational lifecycle**
(`pending → confirmed → processing → shipped → delivered`, with
`cancelled`/`refunded` as terminal alternate branches) rather than the
shorter placeholder enum (`pending | confirmed | shipped | delivered |
cancelled | returned`) originally sketched in Phase 1 — building the real
state machine surfaced that `processing` (payment/fulfillment prep,
distinct from "confirmed but not yet being worked on") and `refunded`
(distinct from a pre-shipment `cancelled`) were both operationally
meaningful states an admin/vendor dashboard needs to filter and report
on separately. The transition table itself
(`ORDER_STATUS_TRANSITIONS`, `constants/order.js`) is enforced
server-side — the same server-side-whitelist pattern Phase 4 established
for vendor status, reused here rather than reinvented.

### Cart — **implemented in Phase 6**
```
Cart {
  _id
  user            ref → User (unique, indexed)
  items           [ { product ref, sku, quantity, priceSnapshot, addedAt } ]  // embedded, mutable
  status          enum: active | converted   // Phase 6 never sets converted — see below
  createdAt / updatedAt
}
```
One document per customer, embedded mutable items — same reasoning as
Wishlist just below: always read/written as one unit, reasonably
bounded, nothing needs to query "who has product X in their cart"
independently of a specific customer.

**`priceSnapshot` is not authoritative — it exists purely for
change-detection display.** Every total this app calculates or would
ever charge re-reads the live `Product.variants[].price` at request time
(`cartPricingService.hydrateCartItems`); nothing is ever billed from a
stored snapshot. Storing an authoritative total on this document would
let it drift from reality the instant a vendor reprices a product —
deriving every total on every read means it structurally can't.

**`sku`, not a separate variant id** — Product has no independent
variant-id field (see the Product section above); SKU is the addressable
identifier for a variant everywhere in this app, and Cart follows the
same convention rather than inventing a second one.

**`status: converted` is defined now, set by nothing in Phase 6.** It
exists so Phase 7 has somewhere to record "this cart became an order"
without a schema migration when that phase ships — Phase 6's checkout
review (`POST /checkout/review`) is read-only and never transitions a
cart's status, consistent with the inventory-reservation boundary below.

### Address — **implemented in Phase 6**
```
Address {
  _id
  user             ref → User (indexed)
  label            enum: home | work | other
  fullName, phone
  line1, line2, city, state, country, postalCode
  isDefaultShipping, isDefaultBilling   boolean
  createdAt / updatedAt
}
```
A **separate, referenced collection**, not embedded on `User` — unlike
Cart/Wishlist, a customer can have *several* addresses and needs to
address one specifically by id (checkout picks one; the address list
page edits/deletes one independently of the others). That's the
"queried/managed independently" case §1's embedding rule calls out for
referencing rather than embedding — the same reasoning, opposite
conclusion, from the same rule Cart and Wishlist apply.

Indexed on `user` (list/ownership queries) and the compound
`{ user, isDefaultShipping }` / `{ user, isDefaultBilling }` pairs (the
"find this customer's default address" lookup checkout runs on every
review). `addressService` clears the previous default before setting a
new one, so at most one document per user ever has each flag `true` in
practice — not enforced as a schema-level uniqueness constraint (a
partial unique index would be one more thing to keep in sync with the
service logic for a guarantee the service already provides).

### Wishlist — **implemented in Phase 5**
```
Wishlist {
  _id
  user       ref → User (unique, indexed)
  products   [ ref → Product ]     // embedded array of references
  createdAt / updatedAt
}
```
One document per user with an embedded array of `Product` references —
not a separate `WishlistItem`-per-row collection. This follows the same
rule as everywhere else on this page (§1): a wishlist is always read and
written as one unit ("my wishlist"), is reasonably bounded (dozens of
items, not thousands), and nothing in the app needs to query "who
wishlisted product X" independently of a specific user's list. Contrast
with `RefreshToken`, which deliberately *is* a separate per-record
collection — there, each token genuinely needs independent expiry and
revocation, which a wishlist entry does not.

A wishlisted product can be hard-deleted independently of the wishlist
that references it — Phase 3's product delete has no awareness that
wishlists exist, and deliberately isn't changed to gain that awareness
(see `docs/ARCHITECTURE.md` on not refactoring a completed phase without
a genuine dependency forcing it). `populate()` silently returns `null`
for that now-dangling reference rather than throwing;
`wishlistService.getOwn` filters those out of the response and quietly
repairs the stored array to match, so a deleted product doesn't
permanently linger as an invisible entry that still counts toward the
list.

### Inventory — **implemented in Phase 7**
Stock still lives on `Product.variants[].stock` (Phase 3) — inventory
management in Phase 7 is a read/adjust *layer* over that existing data,
not a second source of truth. `reservedStock` (added in Phase 3, held at
`0` through Phase 6) remains unused even now: Phase 7's order creation
decrements `stock` directly and atomically rather than reserving-then-
confirming, since the reservation approach would need its own expiry
handling for abandoned carts — real scope, not yet asked for. The field
stays defined for whichever future phase actually needs a
reserve-before-charge flow (e.g. a "pay in 3 days" order type).

```
InventoryLedger {
  _id
  product        ref → Product
  sku
  vendor         ref → User
  changeType     enum: sale | adjustment
  quantityChange (signed: positive = added, negative = removed)
  resultingStock
  reason                                    // required for adjustment, absent for sale
  performedBy    ref → User
  createdAt
}
```
Separate, referenced, append-only — same reasoning as `RefreshToken` and
`AuditLog`: unbounded over time, queried independently of any single
product ("this SKU's stock history"), never read/written as part of
another document's unit of work. Indexed on `{ product, createdAt }` (a
product's own history) and `{ vendor, createdAt }` (a vendor's activity
across all their SKUs). Two write paths, both funneling through
`inventoryService` rather than an ad hoc `InventoryLedger.create`
scattered elsewhere: `adjust` (manual vendor/admin correction — a
`reason` is required, and the resulting stock is rejected, never
clamped, if it would go negative) and `recordSale` (written inside the
same transaction as an order's stock decrement, so the ledger entry and
the stock change it explains can never exist independently of each
other).

**Inventory reservation policy — resolved in Phase 7.** Phase 6
established that cart quantity is not a stock reservation: adding an
item to a cart never decremented `stock` or touched `reservedStock`.
That boundary held all the way through — the first write to
`Product.variants[].stock` in this entire app happens in
`orderService.createFromCart` (Phase 7), inside a transaction, via an
atomic conditional `findOneAndUpdate` (`{ 'variants.stock': { $gte:
quantity } }` in the filter itself) rather than a read-then-write. Two
customers can still simultaneously hold the last unit of a SKU in their
carts — nothing prevents that, by design — but only one of their orders
can win the race at creation time; the other gets a clear "no longer has
enough stock" error and nothing is decremented or charged for them.

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

### AuditLog — **implemented in Phase 7**
```
AuditLog {
  _id
  actor        ref → User
  action       string   // closed set — see constants/audit.js, e.g. 'vendor.approved', 'order.status_changed'
  entityType   string   // 'Vendor' | 'Product' | 'Order'
  entityId     ObjectId
  metadata     Mixed    // sanitized — see docs/SECURITY.md
  createdAt
}
```
Append-only, indexed on `{ actor, createdAt }`, `{ action, createdAt }`,
and `{ entityType, entityId }` — the three ways this actually gets
queried (by admin's own actions, by action type, "history for this
specific entity").

`action` is a closed enum (`AUDIT_ACTION`, `constants/audit.js`), not a
free-form string a caller can invent — a typo in a call site becomes an
import error at build time, not a silently-uncategorized log entry that
`docs/API.md`'s filter dropdown wouldn't know about. Deliberately
lightweight: this is the "who did what, when" operational trail Phase 7
asks for, not the full compliance/retention audit subsystem still listed
under Phase 10 in `docs/ROADMAP.md` (export, tamper-evidence, retention
policy) — building that now would be exactly the premature
infrastructure this project's stated anti-over-engineering rule warns
against.

## 3. Indexing philosophy

Every index above exists because a specific screen or query needs it —
"vendor's product list," "search by title," "orders by customer," "audit
log by actor." No index is added speculatively; unused indexes cost write
performance for no read benefit, which matters more once the product
catalog and order volume grow past demo-data size.

**Phase 5 review**: the new customer-facing query capabilities (`inStock`
filtering, category `productCount` aggregation, vendor-store lookup by
`Vendor.user`) were checked against the existing index set rather than
assumed to need new ones. None do, at this scale: `inStock` filters on
`variants.stock`, an unindexed dotted-path match — adding an index purely
for this would be premature without evidence it's actually a bottleneck,
and it would always be combined with `status` (already indexed) in
practice, which already narrows the scan substantially. The category
count aggregation groups by `Product.category`, which is already indexed
(`{ category: 1, status: 1 }`, from Phase 3). The vendor-store lookup
queries `Vendor` by `user`, which already has a unique index (Phase 4).
Nothing here needed a new index; this section is updated to say so
explicitly, rather than the absence of a change being ambiguous between
"reviewed, not needed" and "not reviewed."

**Phase 6 review**: `Cart.user` gets its index from `unique: true` (one
document per customer, looked up by user id on every cart operation —
exactly the case a unique index serves). `Address.user` is indexed for
the same "list this customer's addresses" reason Vendor/Wishlist/Cart
all share, plus the two compound default-lookup indexes noted in the
Address section above — checkout's "use my default shipping address"
read is the query those exist for. No index was added on `Cart.items` or
`Address` fields beyond `user` — nothing in this phase queries a cart or
address by anything other than its owner and, for Address, its own `_id`
(already indexed for free as the primary key).

**Phase 7 review**: `Order` gets `{ customer, createdAt }` (a customer's
own order history, always sorted newest-first), `{ 'vendorGroups.vendor',
createdAt }` (a vendor's own order list, same sort), and
`{ 'vendorGroups.status' }` (admin/vendor status filtering) —
`orderNumber` already gets its index from `unique: true`. `InventoryLedger`
gets `{ product, createdAt }` and `{ vendor, createdAt }` — a product's
own history and a vendor's activity feed, the two actual read patterns in
`inventoryService.history` and a hypothetical future vendor-wide
adjustment feed. `AuditLog` gets `{ actor, createdAt }`,
`{ action, createdAt }`, and `{ entityType, entityId }` for the same
reason. No index exists on `vendorGroups.items` or any field inside an
order line item — nothing queries "which orders contain product X"
directly, and if that need arises later it's a new, deliberately-added
index, not a speculative one sitting unused today.
