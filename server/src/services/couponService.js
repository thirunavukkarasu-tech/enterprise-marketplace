import { Coupon } from '../models/Coupon.model.js';
import { CouponUsage } from '../models/CouponUsage.model.js';
import { ApiError } from '../utils/ApiError.js';
import { auditService } from './auditService.js';
import { AUDIT_ACTION } from '../constants/audit.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

/**
 * `validateForCart` is the one place every eligibility rule from the
 * spec lives — exists, active, started, not expired, minimum order
 * value, global usage limit, per-user usage limit. Called from
 * `cartService.applyCoupon` (a customer applying a code, `POST
 * /cart/coupon` — see cart.route.js for why coupon state lives under
 * `/cart` rather than `/checkout`) and `orderService.createFromCart`
 * (which re-validates from scratch rather than trusting that an earlier
 * "apply" call is still valid — the same "never trust a stored snapshot"
 * discipline `cartPricingService` applies to prices, applied here to
 * coupon eligibility).
 */
async function validateForCart(code, userId, hydratedItems) {
  const normalized = code.trim().toUpperCase();
  const coupon = await Coupon.findOne({ code: normalized });

  if (!coupon || !coupon.isActive) {
    throw ApiError.badRequest('This coupon code is not valid.');
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw ApiError.badRequest('This coupon is not active yet.');
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw ApiError.badRequest('This coupon has expired.');
  }

  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    throw ApiError.badRequest('This coupon has reached its usage limit.');
  }

  if (coupon.perUserLimit != null) {
    const userUsageCount = await CouponUsage.countDocuments({ coupon: coupon._id, user: userId });
    if (userUsageCount >= coupon.perUserLimit) {
      throw ApiError.badRequest('You have already used this coupon the maximum number of times.');
    }
  }

  // Minimum order value is checked against the subtotal of items that
  // actually count toward the order — an out-of-stock line item's price
  // doesn't help a cart meet the threshold.
  const eligibleSubtotal = hydratedItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  if (eligibleSubtotal < coupon.minOrderValue) {
    throw ApiError.badRequest(`This coupon requires a minimum order value of ${coupon.minOrderValue}.`);
  }

  return coupon;
}

export const couponService = {
  validateForCart,

  /**
   * The read-only counterpart to `validateForCart`. Cart retrieval and
   * checkout review need to show a stored coupon's effect without ever
   * hard-failing a page view — if the coupon has since expired, hit its
   * usage limit, or the cart no longer meets the minimum order value,
   * that's surfaced as `couponError` and the stored code is cleared
   * (the caller persists that), not thrown. Contrast with
   * `applyCoupon`/`createFromCart`, which are write/commit actions and
   * correctly use the strict `validateForCart` — a customer actively
   * applying a code, or an order actually being placed, should see a
   * hard error immediately rather than have the discount silently
   * vanish.
   */
  async resolveForCart(code, userId, hydratedItems) {
    if (!code) return { coupon: null, couponError: null, changed: false };
    try {
      const coupon = await validateForCart(code, userId, hydratedItems);
      return { coupon, couponError: null, changed: false };
    } catch (err) {
      return { coupon: null, couponError: err.message, changed: true };
    }
  },

  /** Written inside the same transaction as order creation — a coupon
   * "applied" during checkout preview but never converted to an order
   * must not consume the usage limit (see the model comment on
   * Coupon.usageCount). */
  async recordUsage({ coupon, userId, orderId, discountAmount, session }) {
    await CouponUsage.create([{ coupon: coupon._id, user: userId, order: orderId, discountAmount }], { session });
    await Coupon.updateOne({ _id: coupon._id }, { $inc: { usageCount: 1 } }, { session });
  },

  // ── admin CRUD ─────────────────────────────────────────────────────────

  async list({ q, isActive, page = PAGINATION_DEFAULTS.PAGE, limit = PAGINATION_DEFAULTS.LIMIT } = {}) {
    const filter = {};
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.code = { $regex: escaped, $options: 'i' };
    }
    if (isActive !== undefined) filter.isActive = isActive;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(filter),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getById(id) {
    const coupon = await Coupon.findById(id);
    if (!coupon) throw ApiError.notFound('Coupon not found');
    return coupon;
  },

  async create(adminUser, payload) {
    const code = payload.code.trim().toUpperCase();
    const existing = await Coupon.findOne({ code });
    if (existing) throw ApiError.conflict('A coupon with this code already exists');

    const coupon = await Coupon.create({ ...payload, code, createdBy: adminUser.id });
    await auditService.record(adminUser.id, AUDIT_ACTION.COUPON_CREATED, 'Coupon', coupon._id, { code: coupon.code });
    return coupon;
  },

  async update(adminUser, id, payload) {
    const coupon = await this.getById(id);
    Object.assign(coupon, payload);
    await coupon.save();
    await auditService.record(adminUser.id, AUDIT_ACTION.COUPON_UPDATED, 'Coupon', coupon._id);
    return coupon;
  },

  async setActive(adminUser, id, isActive) {
    const coupon = await this.getById(id);
    coupon.isActive = isActive;
    await coupon.save();
    await auditService.record(adminUser.id, AUDIT_ACTION.COUPON_STATUS_CHANGED, 'Coupon', coupon._id, { isActive });
    return coupon;
  },

  async remove(adminUser, id) {
    const coupon = await this.getById(id);
    await coupon.deleteOne();
    await auditService.record(adminUser.id, AUDIT_ACTION.COUPON_DELETED, 'Coupon', id, { code: coupon.code });
  },
};
