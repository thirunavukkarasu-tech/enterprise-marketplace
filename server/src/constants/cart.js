export const CART_STATUS = Object.freeze({
  ACTIVE: 'active',
  // Flipped by Phase 7 when an order is created from this cart. Phase 6
  // never sets this — nothing here converts a cart, it only prepares the
  // checkout boundary Phase 7 will act on. See docs/DATABASE.md for how
  // a customer's cart is expected to reset after that happens.
  CONVERTED: 'converted',
});

export const ALL_CART_STATUSES = Object.values(CART_STATUS);

/**
 * A sane upper bound on a single line item's quantity — not a real
 * inventory constraint (that's checked separately against live stock),
 * just a guard against a fat-fingered or scripted absurd quantity. Easy
 * to tune later; documented here rather than as a magic number in the
 * validator.
 */
export const MAX_CART_ITEM_QUANTITY = 20;

/** Per-item issues surfaced on cart retrieval and checkout review — never
 * silently dropped, always shown so the customer can act on them. */
export const CART_ITEM_ISSUE = Object.freeze({
  PRODUCT_UNAVAILABLE: 'product_unavailable', // deleted, or no longer active
  VARIANT_UNAVAILABLE: 'variant_unavailable', // SKU no longer exists on the product
  OUT_OF_STOCK: 'out_of_stock',
  INSUFFICIENT_STOCK: 'insufficient_stock', // some, but not enough, stock left
  PRICE_CHANGED: 'price_changed', // non-blocking — informational only
});
