export const STOCK_STATUS = Object.freeze({
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
});

/**
 * A flat default applied to every variant — not a per-product configurable
 * field. Phase 7 asks for a "low-stock threshold" concept; making it
 * per-product/per-vendor configurable is a real feature with its own
 * validation surface (must it be positive? per-variant or per-product?)
 * that nothing in this phase's spec asks for beyond the concept existing.
 * One constant, easy to find and change, is the honest scope here.
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** Derives status from a live stock number — never stored, so it can't
 * drift from the number it describes (same rule as `availableStock`). */
export function getStockStatus(availableStock, threshold = DEFAULT_LOW_STOCK_THRESHOLD) {
  if (availableStock <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (availableStock <= threshold) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

/** Every reason a ledger entry exists — `SALE` is written by order
 * creation (Phase 7), `ADJUSTMENT` by a manual vendor/admin correction. */
export const INVENTORY_CHANGE_TYPE = Object.freeze({
  SALE: 'sale',
  ADJUSTMENT: 'adjustment',
});
