import { User } from '../models/User.model.js';
import { Order } from '../models/Order.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

/**
 * Read-only view over the existing `User` collection (Phase 2) — no
 * separate Customer model. "Customer management" here means admin
 * visibility into customer accounts and their real order activity, not
 * a second identity system; account status changes (activate/deactivate)
 * reuse the same `User.isActive` field vendor/admin account state
 * already uses elsewhere, not a customer-specific status enum.
 */

async function attachOrderStats(customers) {
  const ids = customers.map((c) => c._id);
  const stats = await Order.aggregate([
    { $match: { customer: { $in: ids } } },
    { $group: { _id: '$customer', orderCount: { $sum: 1 }, totalSpent: { $sum: '$grandTotal' } } },
  ]);
  const byId = new Map(stats.map((s) => [s._id.toString(), s]));

  return customers.map((c) => {
    const stat = byId.get(c._id.toString());
    return {
      ...c.toObject(),
      orderCount: stat?.orderCount ?? 0,
      totalSpent: stat?.totalSpent ?? 0,
    };
  });
}

export const adminCustomerService = {
  async list({ q, isActive, page = PAGINATION_DEFAULTS.PAGE, limit = PAGINATION_DEFAULTS.LIMIT } = {}) {
    const filter = { role: ROLES.CUSTOMER };
    if (isActive !== undefined) filter.isActive = isActive;
    if (q) {
      const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }

    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    const items = await attachOrderStats(customers);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getOne(customerId) {
    const customer = await User.findOne({ _id: customerId, role: ROLES.CUSTOMER });
    if (!customer) throw ApiError.notFound('Customer not found');

    const [orderStats] = await attachOrderStats([customer]);
    const recentOrders = await Order.find({ customer: customerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber grandTotal vendorGroups createdAt');

    return {
      ...orderStats,
      recentOrders: recentOrders.map((o) => ({
        orderId: o._id.toString(),
        orderNumber: o.orderNumber,
        grandTotal: o.grandTotal,
        createdAt: o.createdAt,
      })),
    };
  },
};
