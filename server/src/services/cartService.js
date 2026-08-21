import { Cart } from '../models/Cart.model.js';
import { Product } from '../models/Product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { PRODUCT_STATUS } from '../constants/product.js';
import { MAX_CART_ITEM_QUANTITY } from '../constants/cart.js';
import { hydrateCartItems, calculateTotals } from './cartPricingService.js';

/**
 * Every function here takes `userId` from the caller (the controller,
 * which gets it from `req.user.id` — the verified access token, never a
 * request body or query param). There is no function in this service
 * that accepts an arbitrary user id to look up someone else's cart —
 * the same route-separation-flavored guarantee Phase 4/5 established for
 * vendor profiles and wishlists: the *shape* of this service makes an
 * IDOR here structurally unreachable, not just checked-for.
 */

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
}

async function loadValidatedProductVariant(productId, skuRaw) {
  const sku = skuRaw.trim().toUpperCase(); // Product stores SKUs uppercased — see Product.model.js

  const product = await Product.findById(productId);
  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw ApiError.badRequest('This product is not available.');
  }

  const variant = product.variants.find((v) => v.sku === sku);
  if (!variant) {
    throw ApiError.badRequest('This product variant is not available.');
  }

  return { product, variant, sku };
}

function respond(cart, { shippingMethod } = {}) {
  return hydrateCartItems(cart.items).then((items) => ({
    cartId: cart._id.toString(),
    ...calculateTotals(items, { shippingMethod }),
  }));
}

export const cartService = {
  async getOwnCart(userId, { shippingMethod } = {}) {
    const cart = await getOrCreateCart(userId);
    return respond(cart, { shippingMethod });
  },

  async addItem(userId, { productId, sku, quantity }) {
    const { variant, sku: normalizedSku } = await loadValidatedProductVariant(productId, sku);
    const cart = await getOrCreateCart(userId);

    const existing = cart.items.find((item) => item.product.toString() === productId && item.sku === normalizedSku);
    const requestedTotalQty = (existing?.quantity ?? 0) + quantity;

    if (requestedTotalQty > MAX_CART_ITEM_QUANTITY) {
      throw ApiError.badRequest(`You can add at most ${MAX_CART_ITEM_QUANTITY} of this item.`);
    }
    if (requestedTotalQty > variant.availableStock) {
      throw ApiError.badRequest(
        `Only ${variant.availableStock} in stock — you already have ${existing?.quantity ?? 0} in your cart.`
      );
    }

    if (existing) {
      existing.quantity = requestedTotalQty;
      existing.priceSnapshot = variant.price; // refresh the snapshot to the price just validated against
    } else {
      cart.items.push({ product: productId, sku: normalizedSku, quantity, priceSnapshot: variant.price });
    }

    await cart.save();
    return respond(cart);
  },

  async updateItemQuantity(userId, itemId, quantity) {
    const cart = await getOrCreateCart(userId);
    const item = cart.items.id(itemId);
    if (!item) {
      throw ApiError.notFound('Cart item not found');
    }

    if (quantity > MAX_CART_ITEM_QUANTITY) {
      throw ApiError.badRequest(`You can add at most ${MAX_CART_ITEM_QUANTITY} of this item.`);
    }

    // Re-validate against live stock — the item could have sold out (to
    // other customers' carts converting in a future phase) since it was
    // added. Not a reservation, just a check at the moment of this request.
    const product = await Product.findById(item.product);
    const variant = product?.status === PRODUCT_STATUS.ACTIVE ? product.variants.find((v) => v.sku === item.sku) : null;

    if (!variant) {
      throw ApiError.badRequest('This product is no longer available. Remove it from your cart.');
    }
    if (quantity > variant.availableStock) {
      throw ApiError.badRequest(`Only ${variant.availableStock} in stock.`);
    }

    item.quantity = quantity;
    await cart.save();
    return respond(cart);
  },

  async removeItem(userId, itemId) {
    const cart = await getOrCreateCart(userId);
    // Idempotent: removing an item that's already gone is a success, not
    // a 404 — matches the "handle already-removed items gracefully"
    // requirement and the pattern Phase 5's wishlist already established.
    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
    await cart.save();
    return respond(cart);
  },

  async clearCart(userId) {
    const cart = await getOrCreateCart(userId);
    cart.items = [];
    await cart.save();
    return respond(cart);
  },
};
