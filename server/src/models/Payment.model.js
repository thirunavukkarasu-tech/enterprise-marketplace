import mongoose from 'mongoose';
import { ALL_PAYMENT_STATUSES, PAYMENT_STATUS, ALL_PAYMENT_METHODS, PAYMENT_PROVIDER } from '../constants/order.js';

/**
 * Deliberately never stores card/account numbers, CVV, or any other raw
 * payment credential — only what's needed to track a payment's status
 * and reference it against the provider (`transactionId`) and against
 * safe, non-sensitive provider metadata (`providerMetadata`, e.g. a
 * masked card suffix or a mock response code — never a full PAN or CVV).
 *
 * Not embedded on `Order` (contrast with `orderItemSchema`, which is):
 * an order can have more than one payment attempt over its lifetime (a
 * failed attempt followed by a successful retry), and each attempt is a
 * complete, independent record with its own status history — a
 * one-to-many relationship a single embedded field can't represent.
 * `order` is indexed, not unique, for exactly this reason.
 */
const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ALL_PAYMENT_METHODS, required: true },
    provider: { type: String, enum: Object.values(PAYMENT_PROVIDER), required: true, default: PAYMENT_PROVIDER.MOCK },
    status: { type: String, enum: ALL_PAYMENT_STATUSES, default: PAYMENT_STATUS.PENDING },
    transactionId: { type: String, required: true, unique: true },
    failureReason: { type: String, trim: true, maxlength: 500 },
    providerMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    processingAt: { type: Date },
    paidAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true }
);

// `transactionId` already gets a unique index from `unique: true` above.
paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index({ customer: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

paymentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Payment = mongoose.model('Payment', paymentSchema);
