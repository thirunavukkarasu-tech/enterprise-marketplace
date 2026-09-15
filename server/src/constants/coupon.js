export const DISCOUNT_TYPE = Object.freeze({
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
});

export const ALL_DISCOUNT_TYPES = Object.values(DISCOUNT_TYPE);

/**
 * A percentage discount is capped at 100 by validation (validators/
 * coupon.validator.js) — a value above that would mean a customer is
 * paid to check out, not discounted.
 */
export const MAX_PERCENTAGE_DISCOUNT_VALUE = 100;
