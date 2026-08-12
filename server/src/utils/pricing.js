/**
 * Computes the min/max price across a product's variants. Pure and
 * DB-free so it's directly unit-testable — productService calls this on
 * every create/update to keep Product.priceRange in sync.
 */
export function computePriceRange(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return { min: 0, max: 0 };
  }

  const prices = variants.map((v) => v.price).filter((p) => typeof p === 'number' && !Number.isNaN(p));

  if (prices.length === 0) {
    return { min: 0, max: 0 };
  }

  return { min: Math.min(...prices), max: Math.max(...prices) };
}
