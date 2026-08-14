import { Product } from '../models/Product.model.js';
import { PRODUCT_SORT, PAGINATION_DEFAULTS } from '../constants/product.js';

const SORT_MAP = {
  [PRODUCT_SORT.NEWEST]: { createdAt: -1 },
  [PRODUCT_SORT.PRICE_ASC]: { 'priceRange.min': 1 },
  [PRODUCT_SORT.PRICE_DESC]: { 'priceRange.max': -1 },
  [PRODUCT_SORT.RATING]: { ratingAverage: -1 },
};

/**
 * Isolated here (rather than queried directly from productService) because
 * building this filter is genuinely non-trivial and is shared, with
 * different base constraints, by both the public storefront listing and
 * the vendor/admin "managed" listing — worth a single place to get right
 * once. A simple `findById` elsewhere in the app is not given this
 * treatment; see docs/ARCHITECTURE.md §2 for the rule being applied.
 */
function buildFilter({ search, category, minPrice, maxPrice, status, vendor }) {
  const filter = {};

  if (search) filter.$text = { $search: search };
  if (category) filter.category = category;
  if (vendor) filter.vendor = vendor;

  if (status) {
    filter.status = status;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter['priceRange.min'] = {};
    if (minPrice !== undefined) filter['priceRange.min'].$gte = minPrice;
    if (maxPrice !== undefined) filter['priceRange.min'].$lte = maxPrice;
  }

  return filter;
}

export const productRepository = {
  async list({
    search,
    category,
    minPrice,
    maxPrice,
    status,
    vendor,
    sort = PRODUCT_SORT.NEWEST,
    page = PAGINATION_DEFAULTS.PAGE,
    limit = PAGINATION_DEFAULTS.LIMIT,
  }) {
    const filter = buildFilter({ search, category, minPrice, maxPrice, status, vendor });
    const sortSpec = SORT_MAP[sort] ?? SORT_MAP[PRODUCT_SORT.NEWEST];
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sortSpec).skip(skip).limit(limit).populate('category', 'name slug'),
      Product.countDocuments(filter),
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
    return Product.findById(id).populate('category', 'name slug');
  },

  findBySlug(slug) {
    return Product.findOne({ slug }).populate('category', 'name slug');
  },

  /** Used to enforce global SKU uniqueness across every vendor's products. */
  findBySku(sku, { excludeProductId } = {}) {
    return Product.findOne({
      'variants.sku': sku.toUpperCase(),
      ...(excludeProductId ? { _id: { $ne: excludeProductId } } : {}),
    });
  },
};
