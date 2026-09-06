import { User } from '../models/User.model.js';
import { Vendor } from '../models/Vendor.model.js';
import { Product } from '../models/Product.model.js';
import { Order } from '../models/Order.model.js';
import { auditService } from './auditService.js';
import { ROLES, VENDOR_STATUS } from '../constants/roles.js';
import { PRODUCT_STATUS } from '../constants/product.js';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../constants/inventory.js';
import { ORDER_STATUS } from '../constants/order.js';

const TREND_DAYS = 14;

/**
 * Every number here is a real aggregation against live collections — no
 * hardcoded or randomly-generated figures anywhere in this file. Where a
 * concept doesn't have data behind it yet (e.g. payment settlement),
 * this app simply doesn't claim to report it rather than inventing a
 * plausible-looking number.
 *
 * "Orders" in this dashboard count vendor-fulfillment groups, not whole
 * multi-vendor orders — a single Order can have one vendor group
 * `delivered` and another still `processing`, so "pending orders" is
 * only a meaningful number at the group level, the actual operational
 * unit vendors and admins act on (see Order.model.js).
 */

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getCounts() {
  const [totalUsers, totalVendorAccounts, totalCustomers, totalProducts, activeProducts, pendingVendorApprovals] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: ROLES.VENDOR }),
      User.countDocuments({ role: ROLES.CUSTOMER }),
      Product.countDocuments({}),
      Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE }),
      Vendor.countDocuments({ status: VENDOR_STATUS.PENDING }),
    ]);

  return { totalUsers, totalVendorAccounts, totalCustomers, totalProducts, activeProducts, pendingVendorApprovals };
}

async function getLowStockProductCount() {
  const result = await Product.aggregate([
    { $unwind: '$variants' },
    {
      $addFields: {
        availableStock: { $subtract: ['$variants.stock', '$variants.reservedStock'] },
      },
    },
    { $match: { availableStock: { $gt: 0, $lte: DEFAULT_LOW_STOCK_THRESHOLD } } },
    { $group: { _id: '$_id' } }, // one product counted once even with multiple low-stock variants
    { $count: 'count' },
  ]);
  return result[0]?.count ?? 0;
}

async function getOrderGroupCounts() {
  const PENDING_LIKE = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED];
  const CANCELLED_LIKE = [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED];

  const result = await Order.aggregate([
    { $unwind: '$vendorGroups' },
    {
      $group: {
        _id: null,
        pending: { $sum: { $cond: [{ $in: ['$vendorGroups.status', PENDING_LIKE] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$vendorGroups.status', ORDER_STATUS.DELIVERED] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $in: ['$vendorGroups.status', CANCELLED_LIKE] }, 1, 0] } },
      },
    },
  ]);

  return result[0] ?? { pending: 0, completed: 0, cancelled: 0 };
}

async function getRevenue() {
  const result = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$grandTotal' } } }]);
  return result[0]?.total ?? 0;
}

/** Daily revenue and order count for the last `TREND_DAYS` days — a
 * sparse result (only days with at least one order) is filled with
 * zeros so the frontend chart doesn't have to guess at gaps. */
async function getTrends() {
  const since = dateNDaysAgo(TREND_DAYS - 1);

  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$grandTotal' },
        orders: { $sum: 1 },
      },
    },
  ]);
  const byDate = new Map(rows.map((r) => [r._id, r]));

  const days = [];
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const d = dateNDaysAgo(i);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    days.push({ date: key, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 });
  }
  return days;
}

/** Top vendors by revenue — grouped from real order line items, joined
 * with the Vendor collection for a display name (falls back to "no
 * store profile yet" rather than omitting a vendor with real sales). */
async function getVendorPerformance() {
  const rows = await Order.aggregate([
    { $unwind: '$vendorGroups' },
    {
      $group: {
        _id: '$vendorGroups.vendor',
        revenue: { $sum: '$vendorGroups.subtotal' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);

  const vendorIds = rows.map((r) => r._id);
  const vendors = await Vendor.find({ user: { $in: vendorIds } }).select('storeName user');
  const storeByUserId = new Map(vendors.map((v) => [v.user.toString(), v.storeName]));

  return rows.map((r) => ({
    vendorUserId: r._id.toString(),
    storeName: storeByUserId.get(r._id.toString()) ?? 'No store profile yet',
    revenue: r.revenue,
    orderCount: r.orderCount,
  }));
}

export const adminDashboardService = {
  async getOverview() {
    const [counts, lowStockProductCount, orderGroupCounts, totalRevenue, revenueTrend, vendorPerformance, recentActivity] =
      await Promise.all([
        getCounts(),
        getLowStockProductCount(),
        getOrderGroupCounts(),
        getRevenue(),
        getTrends(),
        getVendorPerformance(),
        auditService.list({ limit: 10 }),
      ]);

    return {
      ...counts,
      lowStockProductCount,
      pendingOrderGroups: orderGroupCounts.pending,
      completedOrderGroups: orderGroupCounts.completed,
      cancelledOrderGroups: orderGroupCounts.cancelled,
      totalRevenue,
      revenueTrend,
      vendorPerformance,
      recentActivity: recentActivity.items,
    };
  },
};
