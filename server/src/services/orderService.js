import mongoose from 'mongoose';
import { Cart } from '../models/Cart.model.js';
import { Order } from '../models/Order.model.js';
import { Product } from '../models/Product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';
import { CART_STATUS } from '../constants/cart.js';
import { ORDER_STATUS, ORDER_STATUS_TRANSITIONS } from '../constants/order.js';
import { AUDIT_ACTION } from '../constants/audit.js';
import { hydrateCartItems, calculateTotals } from './cartPricingService.js';
import { addressService } from './addressService.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { auditService } from './auditService.js';
import { inventoryService } from './inventoryService.js';
import { couponService } from './couponService.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

/**
 * This is where Phase 6's checkout boundary actually gets consumed: the
 * same validation and pricing path `checkoutService.review` uses
 * (`hydrateCartItems` + `calculateTotals`), but now inside a transaction
 * that also atomically decrements stock and persists the Order. Nothing
 * before this file has ever written to `Product.variants[].stock` — see
 * docs/DATABASE.md's inventory reservation policy for why that wait was
 * deliberate, not an oversight.
 */

function groupItemsByVendor(hydratedItems, products) {
  const productById = new Map(products.map((p) => [p._id.toString(), p]));
  const byVendor = new Map();

  for (const item of hydratedItems) {
    const product = productById.get(item.product);
    const vendorId = product.vendor.toString();
    if (!byVendor.has(vendorId)) byVendor.set(vendorId, []);
    byVendor.get(vendorId).push({
      product: item.product,
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.currentPrice,
      lineSubtotal: item.lineSubtotal,
    });
  }

  return [...byVendor.entries()].map(([vendor, items]) => ({
    vendor,
    items,
    subtotal: Number(items.reduce((sum, i) => sum + i.lineSubtotal, 0).toFixed(2)),
    status: ORDER_STATUS.PENDING,
  }));
}

function toAddressSnapshot(address) {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    country: address.country,
    postalCode: address.postalCode,
  };
}

/** Scopes an order's vendorGroups down to just the requesting vendor's
 * own slice — a vendor must never see another vendor's items, pricing,
 * or fulfillment status within the same multi-vendor order. */
function scopeToVendor(order, vendorUserId) {
  const group = order.vendorGroups.find((g) => g.vendor.toString() === vendorUserId);
  if (!group) return null;
  const plain = order.toObject();
  return { ...plain, vendorGroups: [group] };
}

export const orderService = {
  /**
   * Re-validates the cart from scratch (never trusts anything cached
   * from an earlier /checkout/review call), decrements stock atomically
   * per line item inside a transaction, and creates the Order. If any
   * single item's conditional stock update fails — because someone else
   * bought the last unit between review and this request — the whole
   * transaction aborts and nothing is charged or decremented.
   */
  async createFromCart(userId, { shippingAddressId, billingAddressId, shippingMethod }) {
    const cart = await Cart.findOne({ user: userId });
    const hydratedItems = cart ? await hydrateCartItems(cart.items) : [];

    if (hydratedItems.length === 0) {
      throw ApiError.badRequest('Your cart is empty.');
    }

    const totals = calculateTotals(hydratedItems, { shippingMethod });
    if (totals.hasBlockingIssues) {
      throw ApiError.badRequest('Some items in your cart are no longer available. Please review your cart.');
    }

    // Strict, not the graceful resolution GET /cart and checkout review
    // use — placing an order is a commit action. If the coupon shown
    // during review has since gone stale (expired, hit its limit) in
    // the moments between review and this request, the order must fail
    // with a clear error rather than silently drop the discount and
    // charge the customer more than the total they last saw.
    const coupon = cart.couponCode ? await couponService.validateForCart(cart.couponCode, userId, hydratedItems) : null;
    const totalsWithCoupon = calculateTotals(hydratedItems, { shippingMethod, coupon });

    const shippingAddress = await addressService.assertOwned(userId, shippingAddressId);
    const billingAddress = billingAddressId
      ? await addressService.assertOwned(userId, billingAddressId)
      : shippingAddress;

    const productIds = [...new Set(hydratedItems.map((i) => i.product))];
    const products = await Product.find({ _id: { $in: productIds } });
    const vendorGroups = groupItemsByVendor(hydratedItems, products);

    const session = await mongoose.startSession();
    let order;
    try {
      await session.withTransaction(async () => {
        // Atomic, conditional per-SKU decrement: the filter itself
        // requires enough stock to exist at the moment of the write, so
        // two simultaneous orders for the last unit can't both succeed —
        // exactly the race Phase 6 deliberately left unresolved (see
        // docs/DATABASE.md). Whichever loses gets a clear error instead
        // of a negative stock number. `findOneAndUpdate` (not
        // `updateOne`) so the post-decrement stock comes back from the
        // same atomic operation — the ledger entry below is written from
        // what MongoDB actually recorded, never a client-side guess.
        const saleEntries = [];
        for (const item of hydratedItems) {
          const updated = await Product.findOneAndUpdate(
            { _id: item.product, 'variants.sku': item.sku, 'variants.stock': { $gte: item.quantity } },
            { $inc: { 'variants.$.stock': -item.quantity } },
            { session, new: true, projection: { variants: 1, vendor: 1 } }
          );
          if (!updated) {
            throw ApiError.badRequest(`"${item.title}" no longer has enough stock. Please review your cart.`);
          }
          const updatedVariant = updated.variants.find((v) => v.sku === item.sku);
          saleEntries.push({
            product: item.product,
            sku: item.sku,
            vendor: updated.vendor,
            quantity: item.quantity,
            resultingStock: updatedVariant.stock,
            performedBy: userId,
          });
        }

        const orderNumber = await generateOrderNumber();
        const created = await Order.create(
          [
            {
              orderNumber,
              customer: userId,
              vendorGroups,
              shippingAddress: toAddressSnapshot(shippingAddress),
              billingAddress: toAddressSnapshot(billingAddress),
              shippingMethod: totalsWithCoupon.shippingMethod,
              subtotal: totalsWithCoupon.subtotal,
              couponCode: totalsWithCoupon.couponCode,
              discountAmount: totalsWithCoupon.discountAmount,
              taxAmount: totalsWithCoupon.taxAmount,
              shippingFee: totalsWithCoupon.shippingFee,
              grandTotal: totalsWithCoupon.grandTotal,
            },
          ],
          { session }
        );
        order = created[0];

        await inventoryService.recordSale(saleEntries, session);

        if (coupon) {
          await couponService.recordUsage({
            coupon,
            userId,
            orderId: order._id,
            discountAmount: totalsWithCoupon.discountAmount,
            session,
          });
        }

        // Converted, not deleted — Cart.user is a permanent 1:1 document
        // per customer (see cartService.js); the next cart interaction
        // lazily flips this back to active.
        cart.items = [];
        cart.couponCode = null;
        cart.status = CART_STATUS.CONVERTED;
        await cart.save({ session });
      });
    } finally {
      await session.endSession();
    }

    await auditService.record(userId, AUDIT_ACTION.ORDER_CREATED, 'Order', order._id, {
      orderNumber: order.orderNumber,
      grandTotal: order.grandTotal,
      vendorCount: vendorGroups.length,
    });

    return order;
  },

  // ── retrieval, role-aware ────────────────────────────────────────────

  async getForCustomer(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, customer: userId });
    if (!order) throw ApiError.notFound('Order not found');
    return order;
  },

  async listForCustomer(userId, { page = PAGINATION_DEFAULTS.PAGE, limit = PAGINATION_DEFAULTS.LIMIT } = {}) {
    const filter = { customer: userId };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  /** Vendor sees only orders containing at least one of their items, and
   * only their own vendorGroup within each — never another vendor's
   * items, pricing, or fulfillment status inside the same order. */
  async listForVendor(vendorUserId, { status, from, to, page = PAGINATION_DEFAULTS.PAGE, limit = PAGINATION_DEFAULTS.LIMIT } = {}) {
    const filter = { 'vendorGroups.vendor': vendorUserId };
    if (status) filter['vendorGroups'] = { $elemMatch: { vendor: vendorUserId, status } };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);

    const items = orders.map((o) => scopeToVendor(o, vendorUserId));
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getForVendor(vendorUserId, orderId) {
    const order = await Order.findOne({ _id: orderId, 'vendorGroups.vendor': vendorUserId });
    if (!order) throw ApiError.notFound('Order not found');
    return scopeToVendor(order, vendorUserId);
  },

  async listForAdmin({ status, customer, vendor, from, to, page = PAGINATION_DEFAULTS.PAGE, limit = PAGINATION_DEFAULTS.LIMIT } = {}) {
    const filter = {};
    if (customer) filter.customer = customer;
    if (vendor) filter['vendorGroups.vendor'] = vendor;
    if (status) filter['vendorGroups.status'] = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customer', 'name email'),
      Order.countDocuments(filter),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getForAdmin(orderId) {
    const order = await Order.findById(orderId).populate('customer', 'name email');
    if (!order) throw ApiError.notFound('Order not found');
    return order;
  },

  // ── status transitions ──────────────────────────────────────────────

  /**
   * A vendor can only move their own vendorGroup within an order they're
   * part of; an admin can move any vendorGroup on any order but must say
   * which one (`groupId`) since a multi-vendor order has more than one
   * independent status. Both paths funnel through the same server-side
   * transition whitelist — the same pattern Phase 4 established for
   * vendor status and reused here rather than re-invented.
   */
  async updateStatus(user, orderId, { groupId, status }) {
    const order = await Order.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found');

    let group;
    if (user.role === ROLES.VENDOR) {
      group = order.vendorGroups.find((g) => g.vendor.toString() === user.id);
      if (!group) throw ApiError.forbidden('You do not have permission to update this order.');
    } else {
      group = groupId ? order.vendorGroups.id(groupId) : null;
      if (!group) throw ApiError.badRequest('groupId is required and must reference a vendor group on this order.');
    }

    const allowed = ORDER_STATUS_TRANSITIONS[group.status] ?? [];
    if (!allowed.includes(status)) {
      throw ApiError.badRequest(`Cannot move an order from "${group.status}" to "${status}".`);
    }

    const from = group.status;
    group.status = status;
    await order.save();

    await auditService.record(user.id, AUDIT_ACTION.ORDER_STATUS_CHANGED, 'Order', order._id, {
      orderNumber: order.orderNumber,
      groupId: group._id.toString(),
      from,
      to: status,
    });

    return user.role === ROLES.VENDOR ? scopeToVendor(order, user.id) : order;
  },
};
