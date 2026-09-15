import crypto from 'crypto';
import { PAYMENT_STATUS } from '../constants/order.js';

/**
 * This is the ENTIRE payment gateway integration this app has: a mock
 * that simulates a provider's create/verify round trip without moving
 * any real money or touching a real card. It exists so the checkout
 * flow, order/payment consistency rules, and webhook idempotency
 * mechanism can all be built and tested end-to-end against something —
 * but nothing here should be mistaken for a real integration. A real
 * one (Stripe, Razorpay) would replace this file's exports with actual
 * API calls and would NOT expose a `simulate` parameter — that only
 * exists here because there is no real provider to ask for a genuine
 * outcome, and it's the one thing this file can't fake convincingly
 * without one.
 */
export const mockPaymentProvider = {
  /**
   * Simulates initiating a payment with the provider. A real
   * implementation would call the provider's "create payment
   * intent"-style API here and return its reference id.
   */
  async initiate({ amount, method }) {
    return {
      transactionId: `MOCK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      status: PAYMENT_STATUS.PROCESSING,
      providerMetadata: { simulated: true, amount, method },
    };
  },

  /**
   * Simulates asking the provider "did this payment succeed?" A real
   * provider's verify call would return a genuine outcome from its own
   * systems. This one has nothing to ask, so the caller supplies which
   * outcome to simulate — explicitly a testing/demo affordance, gated to
   * only ever be reachable when `provider === 'mock'`
   * (see paymentService.verify).
   */
  async verify({ simulate = 'success' }) {
    if (simulate === 'failure') {
      return { status: PAYMENT_STATUS.FAILED, failureReason: 'Simulated decline (mock provider)' };
    }
    return { status: PAYMENT_STATUS.PAID, providerMetadata: { simulatedOutcome: 'success' } };
  },
};
