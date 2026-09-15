import mongoose from 'mongoose';

/**
 * The entire idempotency strategy for the webhook endpoint lives in this
 * model's unique index, not in application-level "have I seen this
 * before" logic: `paymentService.processWebhookEvent` tries to *insert*
 * a document with the provider's `eventId` before doing anything else.
 * If that insert hits the unique index and fails with a duplicate-key
 * error, the event has already been processed — the handler returns
 * `200` immediately without touching `Payment`/`Order` a second time.
 * This is safe under concurrent duplicate deliveries in a way that a
 * "check then act" read-then-write pattern is not.
 */
const paymentWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    type: { type: String, required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// `eventId` already gets a unique index from `unique: true` above.

export const PaymentWebhookEvent = mongoose.model('PaymentWebhookEvent', paymentWebhookEventSchema);
