import { Vendor } from '../models/Vendor.model.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

const SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name_asc: { storeName: 1 },
  name_desc: { storeName: -1 },
};

/**
 * Isolated here rather than queried directly from vendorService for the
 * same reason as productRepository (see docs/ARCHITECTURE.md §2): the
 * admin vendor list has genuinely non-trivial filter/sort/paginate logic
 * worth a single place to get right, not a copy-pasted findById.
 */
function buildFilter({ q, status, isVerified }) {
  const filter = {};
  if (q) filter.$text = { $search: q };
  if (status) filter.status = status;
  if (isVerified !== undefined) filter.isVerified = isVerified;
  return filter;
}

export const vendorRepository = {
  async list({ q, status, isVerified, sort = 'newest', page = PAGINATION_DEFAULTS.PAGE, limit = PAGINATION_DEFAULTS.LIMIT }) {
    const filter = buildFilter({ q, status, isVerified });
    const sortSpec = SORT_MAP[sort] ?? SORT_MAP.newest;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Vendor.find(filter).sort(sortSpec).skip(skip).limit(limit).populate('user', 'name email isActive'),
      Vendor.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  findById(id) {
    return Vendor.findById(id).populate('user', 'name email isActive');
  },

  findByUserId(userId) {
    return Vendor.findOne({ user: userId });
  },
};
