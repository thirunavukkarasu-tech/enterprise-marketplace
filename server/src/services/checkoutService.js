import { Cart } from '../models/Cart.model.js';
import { ApiError } from '../utils/ApiError.js';
import { hydrateCartItems, calculateTotals } from './cartPricingService.js';
import { addressService } from './addressService.js';

/**
 * This is the "checkout boundary" Phase 7 is expected to build on: a
 * single review/validation pass that returns everything an order would
 * need (validated cart, validated addresses, calculated totals) without
 * persisting anything. Nothing here creates a Cart status change, an
 * Order, or touches inventory — see docs/DATABASE.md for the inventory
 * reservation policy this deliberately stays inside.
 */
export const checkoutService = {
  async review(userId, { shippingAddressId, billingAddressId, shippingMethod }) {
    const cart = await Cart.findOne({ user: userId });
    const items = cart ? await hydrateCartItems(cart.items) : [];

    if (items.length === 0) {
      throw ApiError.badRequest('Your cart is empty.');
    }

    const totals = calculateTotals(items, { shippingMethod });

    // Ownership-checked the same way every other address operation is —
    // a customer cannot check out against an address id that isn't
    // theirs, even if they know it exists.
    const shippingAddress = await addressService.assertOwned(userId, shippingAddressId);
    const billingAddress = billingAddressId
      ? await addressService.assertOwned(userId, billingAddressId)
      : shippingAddress;

    const canProceed = !totals.hasBlockingIssues;

    return {
      ...totals,
      shippingAddress,
      billingAddress,
      canProceed,
      // Non-blocking price changes still let checkout proceed (a
      // customer can accept a small price change and continue), but the
      // response says so explicitly rather than silently charging a
      // different amount than what was shown a moment ago.
      reviewedAt: new Date().toISOString(),
    };
  },
};
