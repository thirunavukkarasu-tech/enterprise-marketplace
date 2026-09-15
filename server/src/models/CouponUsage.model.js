import mongoose from 'mongoose';

/**
 * Separate from `Coupon.usageCount` (a global counter) — this collection
 * exists specifically to answer "how many times has *this user*
 * used *this coupon*," which a single counter on the coupon can't. One
 * document per successful order placed with a coupon, written inside
 * the same transaction as order creation. Not unique on
 * `{coupon, user}` — a coupon with `perUserLimit > 1` is legitimately
 * usable more than once by the same customer, across different orders.
 */
const couponUsageSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    discountAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The query this collection exists to answer: "how many times has this
// user used this coupon" — a per-user limit check on every validation.
couponUsageSchema.index({ coupon: 1, user: 1 });

export const CouponUsage = mongoose.model('CouponUsage', couponUsageSchema);
