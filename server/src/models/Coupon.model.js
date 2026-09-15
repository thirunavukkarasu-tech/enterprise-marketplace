import mongoose from 'mongoose';
import { ALL_DISCOUNT_TYPES, DISCOUNT_TYPE } from '../constants/coupon.js';

/**
 * `usageCount` is the number of orders successfully placed with this
 * code — incremented exactly once, inside the same transaction as order
 * creation (`orderService.createFromCart`), never on "apply to cart"
 * (a preview that never becomes an order must not consume the limit).
 * `CouponUsage` (separate collection) is what makes the *per-user* limit
 * enforceable — this field alone only answers the global-limit question.
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    description: { type: String, trim: true, maxlength: 500 },
    discountType: { type: String, enum: ALL_DISCOUNT_TYPES, required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, min: 0, default: null },
    minOrderValue: { type: Number, min: 0, default: 0 },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, min: 1, default: null },
    usageCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, min: 1, default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// `code` already gets a unique index from `unique: true` above.
couponSchema.index({ isActive: 1 });
couponSchema.index({ expiresAt: 1 });

couponSchema.pre('validate', function assertPercentageBounds(next) {
  if (this.discountType === DISCOUNT_TYPE.PERCENTAGE && this.discountValue > 100) {
    return next(new Error('Percentage discount cannot exceed 100'));
  }
  next();
});

couponSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Coupon = mongoose.model('Coupon', couponSchema);
