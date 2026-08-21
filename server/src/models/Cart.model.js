import mongoose from 'mongoose';
import { CART_STATUS, ALL_CART_STATUSES } from '../constants/cart.js';

/**
 * Cart items store a price *snapshot* purely for change-detection display
 * ("this went up since you added it") — never for billing. Every total
 * this app calculates or charges always re-reads the live
 * `Product.variants[].price` at request time (see
 * `services/cartPricingService.js`). Storing authoritative totals on this
 * document would let them drift from reality the moment a vendor
 * reprices a product; deriving them on every read means they can't.
 */
const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  // Products have no separate variant id (see Product.model.js) — sku is
  // the addressable identifier for a variant, same as everywhere else in
  // the app (product routes, order line items will do the same later).
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  // Snapshot only — see the schema-level comment above.
  priceSnapshot: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now },
});

/**
 * One Cart document per customer — same reasoning as Wishlist
 * (docs/DATABASE.md): always read/written as one unit ("my cart"),
 * reasonably bounded, nothing needs to query "who has product X in their
 * cart" independently of a specific user. `status` exists now so Phase 7
 * has somewhere to record "this cart became an order" without a schema
 * migration, but Phase 6 never sets it to anything but `active` — no
 * checkout flow in this phase creates an order or converts a cart.
 */
const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    status: { type: String, enum: ALL_CART_STATUSES, default: CART_STATUS.ACTIVE },
  },
  { timestamps: true }
);

// `user` already gets a unique index from `unique: true` above — no
// separate schema.index() call for it (see the Phase 2 postmortem on
// duplicate-index warnings, consistently re-applied since).

cartSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Cart = mongoose.model('Cart', cartSchema);
