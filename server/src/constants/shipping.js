/**
 * Flat-rate placeholder shipping methods. This is a foundation for the
 * checkout boundary, not a carrier integration or a rates engine — real
 * shipping (carrier APIs, weight/distance-based rates, per-vendor
 * shipping) is out of scope for Phase 6. The fees below are deliberately
 * simple, fixed numbers so checkout has something real (not fake/random)
 * to calculate against, and are trivial to replace with a real rates
 * lookup later without changing any caller's shape — every consumer
 * calls `getShippingFee(method)`, never reads SHIPPING_METHODS directly.
 */
export const SHIPPING_METHOD = Object.freeze({
  STANDARD: 'standard',
  EXPRESS: 'express',
});

export const ALL_SHIPPING_METHODS = Object.values(SHIPPING_METHOD);

const SHIPPING_FEES = Object.freeze({
  [SHIPPING_METHOD.STANDARD]: 0,
  [SHIPPING_METHOD.EXPRESS]: 15,
});

export function getShippingFee(method) {
  return SHIPPING_FEES[method] ?? 0;
}
