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

/** No real payment gateway exists yet (see docs/ARCHITECTURE.md §7) — this
 * is a placeholder field so the Order schema doesn't need a migration
 * when Phase 7+ payment work lands. Every order is created `pending`;
 * nothing in this app currently transitions it. */
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
});
