import { Product } from '../models/Product.model.js';
import { PRODUCT_STATUS } from '../constants/product.js';
import { CART_ITEM_ISSUE } from '../constants/cart.js';
import { getShippingFee, SHIPPING_METHOD } from '../constants/shipping.js';

/**
 * The one place cart/checkout totals are computed. `cartService` (cart
 * retrieval) and `checkoutService` (checkout review) both call this —
 * neither duplicates the math, and Phase 7's order creation is expected
 * to call it too rather than reimplementing pricing a third time (see
 * docs/ARCHITECTURE.md).
 *
 * The governing rule, stated once here rather than scattered across
 * every caller: **nothing about price or availability is ever trusted
 * from a stored snapshot or a request body.** Every call re-reads live
 * `Product` documents. `priceSnapshot` on a cart item exists only to
 * detect and display a price change — the actual subtotal always uses
 * the current live price.
 */

/**
 * Re-reads live product/variant data for every cart item and attaches
 * the current price, current stock, and any blocking/non-blocking issue.
 * Items with a blocking issue contribute 0 to the subtotal — you can't
 * charge for something that's no longer available — but are still
 * returned so the UI can show *why*, not just silently drop them.
 */
export async function hydrateCartItems(items) {
  if (items.length === 0) return [];

  const productIds = [...new Set(items.map((item) => item.product.toString()))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  return items.map((item) => {
    const product = productById.get(item.product.toString());
    const base = {
      itemId: item._id.toString(),
      product: item.product.toString(),
      sku: item.sku,
      quantity: item.quantity,
      priceSnapshot: item.priceSnapshot,
      addedAt: item.addedAt,
    };

    if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
      return { ...base, title: product?.title ?? null, currentPrice: null, availableStock: 0, issue: CART_ITEM_ISSUE.PRODUCT_UNAVAILABLE, lineSubtotal: 0 };
    }

    const variant = product.variants.find((v) => v.sku === item.sku);
    if (!variant) {
      return { ...base, title: product.title, currentPrice: null, availableStock: 0, issue: CART_ITEM_ISSUE.VARIANT_UNAVAILABLE, lineSubtotal: 0 };
    }

    if (variant.availableStock <= 0) {
      return {
        ...base,
        title: product.title,
        image: product.images[0] ?? null,
        currentPrice: variant.price,
        availableStock: 0,
        issue: CART_ITEM_ISSUE.OUT_OF_STOCK,
        lineSubtotal: 0,
      };
    }

    if (variant.availableStock < item.quantity) {
      return {
        ...base,
        title: product.title,
        image: product.images[0] ?? null,
        currentPrice: variant.price,
        availableStock: variant.availableStock,
        issue: CART_ITEM_ISSUE.INSUFFICIENT_STOCK,
        lineSubtotal: 0,
      };
    }

    // Available and sufficient stock — priced at the CURRENT price,
    // never the snapshot. `priceChanged` is informational only; it does
    // not block the line item from being priced and totaled normally.
    const priceChanged = variant.price !== item.priceSnapshot;
    return {
      ...base,
      title: product.title,
      image: product.images[0] ?? null,
      currentPrice: variant.price,
      availableStock: variant.availableStock,
      issue: priceChanged ? CART_ITEM_ISSUE.PRICE_CHANGED : null,
      lineSubtotal: Number((variant.price * item.quantity).toFixed(2)),
    };
  });
}

const BLOCKING_ISSUES = new Set([
  CART_ITEM_ISSUE.PRODUCT_UNAVAILABLE,
  CART_ITEM_ISSUE.VARIANT_UNAVAILABLE,
  CART_ITEM_ISSUE.OUT_OF_STOCK,
  CART_ITEM_ISSUE.INSUFFICIENT_STOCK,
]);

/**
 * Discount and tax are deliberate extension points, not implemented
 * calculations:
 *   - Discounts belong to Phase 9 (coupons/promotions). Returning a flat
 *     zero here — rather than omitting the field — keeps the response
 *     shape stable for the frontend across the phase boundary; when
 *     Phase 9 lands, only this function's body changes.
 *   - Tax is jurisdiction-specific and legally sensitive; this app has
 *     no defined tax requirement, so it stays at zero rather than
 *     guessing at a rate. See docs/SECURITY.md and docs/ARCHITECTURE.md.
 */
function calculateDiscount(_hydratedItems) {
  return 0;
}

function calculateTax(_subtotal) {
  return 0;
}

/**
 * The single calculation path referenced throughout this app's docs as
 * "cart items → validation → current prices → subtotals → discount →
 * tax → shipping → grand total." Called with already-hydrated items so
 * it stays pure and easy to unit test without touching the database.
 */
export function calculateTotals(hydratedItems, { shippingMethod = SHIPPING_METHOD.STANDARD } = {}) {
  const hasBlockingIssues = hydratedItems.some((item) => BLOCKING_ISSUES.has(item.issue));
  const hasPriceChanges = hydratedItems.some((item) => item.issue === CART_ITEM_ISSUE.PRICE_CHANGED);

  const subtotal = Number(hydratedItems.reduce((sum, item) => sum + item.lineSubtotal, 0).toFixed(2));
  const discountAmount = calculateDiscount(hydratedItems);
  const taxAmount = calculateTax(subtotal - discountAmount);
  const shippingFee = hydratedItems.length > 0 ? getShippingFee(shippingMethod) : 0;
  const grandTotal = Number((subtotal - discountAmount + taxAmount + shippingFee).toFixed(2));

  return {
    items: hydratedItems,
    itemCount: hydratedItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    discountAmount,
    taxAmount,
    shippingMethod,
    shippingFee,
    grandTotal,
    hasBlockingIssues,
    hasPriceChanges,
    priceChangeMessage: hasPriceChanges
      ? 'One or more item prices have changed. Please review your cart before checkout.'
      : null,
  };
}
