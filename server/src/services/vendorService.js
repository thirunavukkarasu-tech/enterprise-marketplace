import { Vendor } from '../models/Vendor.model.js';
import { Product } from '../models/Product.model.js';
import { vendorRepository } from '../repositories/vendor.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { VENDOR_STATUS, VENDOR_STATUS_TRANSITIONS } from '../constants/roles.js';
import { PRODUCT_STATUS } from '../constants/product.js';

// Fields a vendor may set on their own profile. Kept as an explicit
// allow-list applied in the service — even though the validator already
// excludes admin-controlled fields, this is the second, independent layer
// (see docs/SECURITY.md §3): a validator bug shouldn't be the only thing
// standing between a request body and a mass-assignment of `status` or
// `isVerified`. Every write to a Vendor document in this file goes
// through one of these two explicit field lists, never `Object.assign`
// or `Vendor.findByIdAndUpdate(id, req.body)`.
const SELF_EDITABLE_FIELDS = [
  'storeName',
  'legalBusinessName',
  'description',
  'businessEmail',
  'businessPhone',
  'address',
  'taxId',
  'logo',
  'banner',
];

function applyFields(doc, payload, allowedFields) {
  for (const field of allowedFields) {
    if (payload[field] !== undefined) doc[field] = payload[field];
  }
}

function assertTransitionAllowed(currentStatus, nextStatus) {
  const allowed = VENDOR_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.badRequest(`Cannot move a vendor from "${currentStatus}" to "${nextStatus}"`);
  }
}

async function loadOwnOrThrow(userId) {
  const vendor = await vendorRepository.findByUserId(userId);
  if (!vendor) {
    throw ApiError.notFound('You have not created a vendor profile yet');
  }
  return vendor;
}

/**
 * Profile completeness is a simple, honest signal for the vendor
 * dashboard — not a scored/weighted "quality score." Every optional field
 * counts equally; there's nothing here a vendor could game beyond just
 * filling in real information, which is the point.
 */
function computeProfileCompletion(vendor) {
  const optionalFields = [
    vendor.legalBusinessName,
    vendor.description,
    vendor.taxId,
    vendor.logo?.url,
    vendor.banner?.url,
  ];
  const filled = optionalFields.filter(Boolean).length;
  // Required fields (storeName, businessEmail, businessPhone, address)
  // always exist by the time a Vendor document is created, so they
  // always contribute their share — completion starts at a baseline, not
  // at 0%, for a freshly onboarded vendor.
  const requiredWeight = 50;
  const optionalWeight = Math.round((filled / optionalFields.length) * 50);
  return requiredWeight + optionalWeight;
}

export const vendorService = {
  // ── onboarding & self-service ──────────────────────────────────────
  async createOwnProfile(userId, payload) {
    const existing = await vendorRepository.findByUserId(userId);
    if (existing) {
      throw ApiError.conflict('A vendor profile already exists for this account');
    }

    const vendor = new Vendor({
      user: userId,
      status: VENDOR_STATUS.PENDING, // always forced — never trust a client-sent status
    });
    applyFields(vendor, payload, SELF_EDITABLE_FIELDS);
    await vendor.save();

    logger.info('Vendor profile submitted for review', { userId, vendorId: vendor._id.toString() });
    return vendor;
  },

  async getOwnProfile(userId) {
    return loadOwnOrThrow(userId);
  },

  async updateOwnProfile(userId, payload) {
    const vendor = await loadOwnOrThrow(userId);
    applyFields(vendor, payload, SELF_EDITABLE_FIELDS);
    await vendor.save();
    return vendor;
  },

  async getOwnDashboard(userId) {
    const vendor = await loadOwnOrThrow(userId);

    const [total, active, draft, archived] = await Promise.all([
      Product.countDocuments({ vendor: userId }),
      Product.countDocuments({ vendor: userId, status: PRODUCT_STATUS.ACTIVE }),
      Product.countDocuments({ vendor: userId, status: PRODUCT_STATUS.DRAFT }),
      Product.countDocuments({ vendor: userId, status: PRODUCT_STATUS.ARCHIVED }),
    ]);

    const recentProducts = await Product.find({ vendor: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title slug status priceRange createdAt');

    const notices = [];
    if (vendor.status === VENDOR_STATUS.PENDING) {
      notices.push({ tone: 'info', message: 'Your store is awaiting admin review before it can go live.' });
    }
    if (vendor.status === VENDOR_STATUS.REJECTED) {
      notices.push({ tone: 'error', message: vendor.rejectionReason || 'Your vendor application was rejected.' });
    }
    if (vendor.status === VENDOR_STATUS.SUSPENDED) {
      notices.push({ tone: 'error', message: vendor.suspensionReason || 'Your store has been suspended.' });
    }
    if (vendor.status === VENDOR_STATUS.APPROVED && total === 0) {
      notices.push({ tone: 'info', message: 'Add your first product to start selling.' });
    }

    return {
      vendor,
      productCounts: { total, active, draft, archived },
      profileCompletion: computeProfileCompletion(vendor),
      recentProducts,
      notices,
    };
  },

  // ── admin management ────────────────────────────────────────────────
  async listAll(query) {
    return vendorRepository.list(query);
  },

  async getById(id) {
    const vendor = await vendorRepository.findById(id);
    if (!vendor) throw ApiError.notFound('Vendor not found');
    return vendor;
  },

  async approve(adminUser, id) {
    const vendor = await this.getById(id);
    if (vendor.user._id?.toString() === adminUser.id || vendor.user.toString() === adminUser.id) {
      // Defensive only — an admin and a vendor are different roles on
      // different accounts in practice, so this can't currently happen
      // through the API. Kept as an explicit guard rather than an
      // assumption, since "a vendor can never approve themselves" is a
      // stated business rule, not an implementation detail.
      throw ApiError.forbidden('You cannot review your own vendor profile');
    }
    assertTransitionAllowed(vendor.status, VENDOR_STATUS.APPROVED);

    vendor.status = VENDOR_STATUS.APPROVED;
    vendor.reviewedBy = adminUser.id;
    vendor.reviewedAt = new Date();
    vendor.rejectionReason = undefined;
    vendor.suspensionReason = undefined;
    await vendor.save();

    logger.info('Vendor approved', { vendorId: id, adminId: adminUser.id });
    return vendor;
  },

  async reject(adminUser, id, reason) {
    const vendor = await this.getById(id);
    assertTransitionAllowed(vendor.status, VENDOR_STATUS.REJECTED);

    vendor.status = VENDOR_STATUS.REJECTED;
    vendor.reviewedBy = adminUser.id;
    vendor.reviewedAt = new Date();
    vendor.rejectionReason = reason;
    await vendor.save();

    logger.info('Vendor rejected', { vendorId: id, adminId: adminUser.id });
    return vendor;
  },

  async suspend(adminUser, id, reason) {
    const vendor = await this.getById(id);
    assertTransitionAllowed(vendor.status, VENDOR_STATUS.SUSPENDED);

    vendor.status = VENDOR_STATUS.SUSPENDED;
    vendor.reviewedBy = adminUser.id;
    vendor.reviewedAt = new Date();
    vendor.suspensionReason = reason;
    await vendor.save();

    logger.warn('Vendor suspended', { vendorId: id, adminId: adminUser.id, reason });
    return vendor;
  },

  async reactivate(adminUser, id) {
    const vendor = await this.getById(id);
    assertTransitionAllowed(vendor.status, VENDOR_STATUS.APPROVED);

    vendor.status = VENDOR_STATUS.APPROVED;
    vendor.reviewedBy = adminUser.id;
    vendor.reviewedAt = new Date();
    vendor.suspensionReason = undefined;
    await vendor.save();

    logger.info('Vendor reactivated', { vendorId: id, adminId: adminUser.id });
    return vendor;
  },

  /**
   * Independent of the status state machine on purpose — verifying a
   * vendor's business documents is a separate admin judgment from
   * whether their store is currently allowed to sell (see the
   * `isVerified` field comment on the Vendor model). Callable regardless
   * of current status: an admin can verify a still-pending applicant's
   * documents ahead of approving them, or leave a suspended vendor's
   * verification intact since suspension doesn't retroactively make
   * their business information fraudulent.
   */
  async setVerification(adminUser, id, isVerified) {
    const vendor = await this.getById(id);
    vendor.isVerified = isVerified;
    vendor.verifiedBy = isVerified ? adminUser.id : undefined;
    vendor.verifiedAt = isVerified ? new Date() : undefined;
    await vendor.save();

    logger.info(`Vendor ${isVerified ? 'verified' : 'unverified'}`, { vendorId: id, adminId: adminUser.id });
    return vendor;
  },
};
