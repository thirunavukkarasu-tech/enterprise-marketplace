import mongoose from 'mongoose';
import { Payment } from '../models/Payment.model.js';
import { PaymentWebhookEvent } from '../models/PaymentWebhookEvent.model.js';
import { Order } from '../models/Order.model.js';
import { mockPaymentProvider } from '../utils/mockPaymentProvider.js';
import { ApiError } from '../utils/ApiError.js';
import { auditService } from './auditService.js';
import { AUDIT_ACTION } from '../constants/audit.js';
import { logger } from '../config/logger.js';
import { PAYMENT_STATUS, PAYMENT_STATUS_TRANSITIONS, PAYMENT_PROVIDER, ORDER_STATUS } from '../constants/order.js';

function assertPaymentTransitionAllowed(from, to) {
  const allowed = PAYMENT_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw ApiError.badRequest(`Cannot move a payment from "${from}" to "${to}".`);
  }
}

async function loadOwnedOrder(orderId, userId) {
  const order = await Order.findOne({ _id: orderId, customer: userId });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

/**
 * The one place a payment outcome is actually applied to both `Payment`
 * and `Order` — called from both the customer-facing `verify` endpoint
 * and the webhook path, so there's exactly one function that knows how
 * to keep the two documents consistent, not two independent copies that
 * could drift. Runs inside a transaction: a reader must never observe a
 * `Payment.status = 'paid'` while `Order.paymentStatus` still says
 * `'pending'`, even for the instant between two separate writes.
 */
async function applyOutcome(payment, outcome) {
  assertPaymentTransitionAllowed(payment.status, outcome.status);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      payment.status = outcome.status;
      if (outcome.status === PAYMENT_STATUS.PAID) payment.paidAt = new Date();
      if (outcome.status === PAYMENT_STATUS.FAILED) {
        payment.failedAt = new Date();
        payment.failureReason = outcome.failureReason;
      }
      if (outcome.status === PAYMENT_STATUS.CANCELLED) payment.cancelledAt = new Date();
      if (outcome.providerMetadata) {
        payment.providerMetadata = { ...payment.providerMetadata, ...outcome.providerMetadata };
      }
      await payment.save({ session });

      const order = await Order.findById(payment.order).session(session);
      if (order) {
        order.paymentStatus = payment.status;

        // Every vendor group starts PENDING at order creation
        // (orderService.createFromCart) — a successful payment confirms
        // all of them at once. A failed payment leaves order status
        // untouched — the order stays pending, awaiting a retried
        // payment, not auto-cancelled.
        if (payment.status === PAYMENT_STATUS.PAID) {
          for (const group of order.vendorGroups) {
            if (group.status === ORDER_STATUS.PENDING) group.status = ORDER_STATUS.CONFIRMED;
          }
        }
        await order.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }

  return payment;
}

export const paymentService = {
  /**
   * Starts a payment attempt for an order the caller owns. An order can
   * have more than one attempt over its lifetime (see the Payment model
   * comment) — a customer whose first attempt failed can call this again
   * without the earlier failed Payment blocking a retry.
   */
  async initiate(user, { orderId, method }) {
    const order = await loadOwnedOrder(orderId, user.id);

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      throw ApiError.badRequest('This order has already been paid.');
    }

    const providerResult = await mockPaymentProvider.initiate({ amount: order.grandTotal, method });

    const payment = await Payment.create({
      order: order._id,
      customer: user.id,
      amount: order.grandTotal,
      method,
      provider: PAYMENT_PROVIDER.MOCK,
      status: providerResult.status,
      transactionId: providerResult.transactionId,
      providerMetadata: providerResult.providerMetadata,
      processingAt: new Date(),
    });

    order.paymentStatus = payment.status;
    await order.save();

    await auditService.record(user.id, AUDIT_ACTION.PAYMENT_CREATED, 'Payment', payment._id, {
      orderId: order._id.toString(),
      amount: payment.amount,
      method,
    });

    return payment;
  },

  /**
   * Customer-facing "check on my payment" call. `simulate` is only ever
   * read by the mock provider (see mockPaymentProvider.js) — this
   * endpoint's shape doesn't change when a real provider replaces it,
   * that parameter just stops being honored.
   */
  async verify(user, paymentId, { simulate } = {}) {
    const payment = await Payment.findOne({ _id: paymentId, customer: user.id });
    if (!payment) throw ApiError.notFound('Payment not found');

    // The `simulate` affordance only makes sense for the mock provider —
    // a real provider's outcome comes from asking the provider, never
    // from the client, so this is the one place that distinction is
    // enforced in code rather than left as a comment's promise.
    if (payment.provider !== PAYMENT_PROVIDER.MOCK) {
      throw ApiError.badRequest('This payment is not using the mock provider and cannot be manually verified.');
    }

    const outcome = await mockPaymentProvider.verify({ simulate });
    await applyOutcome(payment, outcome);

    await auditService.record(
      user.id,
      payment.status === PAYMENT_STATUS.PAID ? AUDIT_ACTION.PAYMENT_SUCCEEDED : AUDIT_ACTION.PAYMENT_FAILED,
      'Payment',
      payment._id,
      { orderId: payment.order.toString(), status: payment.status }
    );

    return payment;
  },

  async getOwn(user, paymentId) {
    const payment = await Payment.findOne({ _id: paymentId, customer: user.id });
    if (!payment) throw ApiError.notFound('Payment not found');
    return payment;
  },

  /**
   * Idempotency is the unique index on `PaymentWebhookEvent.eventId`,
   * not application logic — this tries to INSERT the event before doing
   * anything else. If the insert hits the unique index and fails with a
   * duplicate-key error, this exact event has already been processed;
   * return success immediately without touching Payment/Order again.
   * That's safe under concurrent duplicate deliveries in a way a
   * "check row exists, then act" pattern is not.
   *
   * Never trusts the webhook body to declare a payment PAID beyond what
   * the same transition whitelist `verify()` uses would allow —
   * `applyOutcome` rejects an illegal transition here exactly as it
   * would for a customer-initiated verify call.
   */
  async processWebhookEvent({ eventId, provider, type, payload }) {
    let eventDoc;
    try {
      eventDoc = await PaymentWebhookEvent.create({ eventId, provider, type, payload });
    } catch (err) {
      if (err.code === 11000) {
        logger.info('Duplicate webhook event ignored', { eventId, provider, type });
        return { duplicate: true, processed: false };
      }
      throw err;
    }

    const transactionId = payload?.transactionId;
    const statusByType = {
      'payment.succeeded': PAYMENT_STATUS.PAID,
      'payment.failed': PAYMENT_STATUS.FAILED,
      'payment.cancelled': PAYMENT_STATUS.CANCELLED,
    };
    const nextStatus = statusByType[type];

    if (!transactionId || !nextStatus) {
      logger.warn('Webhook event did not map to a known payment outcome', { eventId, type });
      return { duplicate: false, processed: false };
    }

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      logger.warn('Webhook event referenced an unknown transactionId', { eventId, transactionId });
      return { duplicate: false, processed: false };
    }

    await applyOutcome(payment, { status: nextStatus, failureReason: payload?.failureReason });
    eventDoc.payment = payment._id;
    await eventDoc.save();

    return { duplicate: false, processed: true };
  },
};
