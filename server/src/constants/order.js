export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

export const ALL_ORDER_STATUSES = Object.values(ORDER_STATUS);

/**
 * Same pattern as VENDOR_STATUS_TRANSITIONS (constants/roles.js): a
 * server-side whitelist, not inferred from whatever status string a
 * request sends. `assertOrderTransitionAllowed` (orderService) rejects
 * anything not listed here with a 400, even from an admin.
 */
export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUNDED]: [],
});

/**
 * Payment status is a separate lifecycle from order status — a payment
 * can fail and be retried without the order itself changing shape (see
 * paymentService.js). Same server-side-whitelist pattern as
 * ORDER_STATUS_TRANSITIONS and VENDOR_STATUS_TRANSITIONS: a payment
 * cannot skip from PENDING straight to PAID without passing through
 * PROCESSING, and a PAID payment can only ever move to REFUNDED — never
 * back to PENDING/FAILED, since that would let a completed charge be
 * silently un-happened.
 */
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

export const ALL_PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

export const PAYMENT_STATUS_TRANSITIONS = Object.freeze({
  [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.PROCESSING]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.PAID]: [PAYMENT_STATUS.REFUNDED],
  [PAYMENT_STATUS.FAILED]: [],
  [PAYMENT_STATUS.CANCELLED]: [],
  [PAYMENT_STATUS.REFUNDED]: [],
});

export const PAYMENT_METHOD = Object.freeze({
  CARD: 'card',
  UPI: 'upi',
});

export const ALL_PAYMENT_METHODS = Object.values(PAYMENT_METHOD);

/**
 * Only one provider exists: a mock that simulates outcomes for
 * development/testing. It is never presented to the customer as a real
 * gateway (see PaymentMethodStep.tsx) and its "simulate a decline"
 * capability (paymentService.verify's `simulate` param) only exists
 * because `PAYMENT_PROVIDER === 'mock'` — a real provider integration
 * would replace mockPaymentProvider.js entirely, and that knob would not
 * exist in it, since a real provider's outcome comes from the provider,
 * never from the client.
 */
export const PAYMENT_PROVIDER = Object.freeze({
  MOCK: 'mock',
});
