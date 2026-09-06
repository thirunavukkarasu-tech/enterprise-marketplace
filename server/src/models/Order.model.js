import mongoose from 'mongoose';
import { ORDER_STATUS, ALL_ORDER_STATUSES, PAYMENT_STATUS } from '../constants/order.js';

/**
 * Order line items are embedded **price/title snapshots**, not live
 * references — an order must show what was actually charged even if the
 * product is later repriced, its variant removed, or the product itself
 * deleted. Same reasoning as Cart items, but immutable here: nothing
 * ever re-reads live product data for an existing order the way
 * `cartPricingService` does for a cart.
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineSubtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

/**
 * One entry per vendor represented in the checkout that created this
 * order. `Product.vendor` (and everywhere else in this app) references
 * `User`, not a separate `Vendor` document (see docs/DATABASE.md) —
 * `vendorGroups.vendor` follows the same convention rather than
 * introducing a second one for orders alone. Each group carries its own
 * fulfillment `status`: a multi-vendor order genuinely has independent
 * per-seller lifecycles (one vendor ships today, another is still
 * processing) — a single order-level status field couldn't represent
 * that honestly.
 */
const vendorGroupSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ALL_ORDER_STATUSES, default: ORDER_STATUS.PENDING },
  },
  { timestamps: true }
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendorGroups: { type: [vendorGroupSchema], required: true },
    shippingAddress: { type: addressSnapshotSchema, required: true },
    billingAddress: { type: addressSnapshotSchema, required: true },
    shippingMethod: { type: String, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, default: 0, min: 0 },
    taxAmount: { type: Number, required: true, default: 0, min: 0 },
    shippingFee: { type: Number, required: true, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    // No payment gateway exists yet (docs/ARCHITECTURE.md §7) — every
    // order is created `pending` and nothing in this app transitions it.
    // The field exists now so a later phase's payment integration is a
    // service change, not a schema migration.
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
  },
  { timestamps: true }
);

// `orderNumber` already gets a unique index from `unique: true` above.
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ 'vendorGroups.vendor': 1, createdAt: -1 });
orderSchema.index({ 'vendorGroups.status': 1 });
orderSchema.index({ createdAt: -1 });

orderSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Order = mongoose.model('Order', orderSchema);
