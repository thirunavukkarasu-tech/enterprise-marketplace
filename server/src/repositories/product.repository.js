import { Product } from '../models/Product.model.js';
import { PRODUCT_SORT_OPTIONS, PUBLIC_PRODUCT_STATUSES } from '../constants/product.js';

/**
 * A repository exists here specifically because product search/filter is
 * the complex-query case docs/ARCHITECTURE.md calls out — everywhere else
 * in this codebase, simple CRUD stays directly in the service. Keeping
 * the filter/sort object-building as pure, exported functions (not
 * private closures) means the query logic itself is unit-testable without
 * a database connection — only `find*` below needs one.
 */

export function buildPublicFilter({ q, category, minPrice, maxPrice }) {
  const filter = { status: { $in: PUBLIC_PRODUCT_STATUSES } };

  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;

  if (minPrice != null || maxPrice != null) {
    filter['priceRange.min'] = {};
    if (minPrice != null) filter['priceRange.min'].$gte = minPrice;
    if (maxPrice != null) filter['priceRange.min'].$lte = maxPrice;
  }

  return filter;
}

/**
 * Managed (vendor/admin) listing filter. `scope` is decided by the
 * service based on the caller's role — this function never sees a role,
 * it only ever sees the vendor id it's told to scope to (or none, for an
 * admin viewing everything). That keeps the authorization decision in one
 * place (the service) and this function purely mechanical.
 */
export function buildManagedFilter({ q, category, status, vendor }) {
  const filter = {};
  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (vendor) filter.vendor = vendor;
  return filter;
}

export function buildSort(sort) {
  switch (sort) {
    case PRODUCT_SORT_OPTIONS.PRICE_ASC:
      return { 'priceRange.min': 1 };
    case PRODUCT_SORT_OPTIONS.PRICE_DESC:
      return { 'priceRange.min': -1 };
    case PRODUCT_SORT_OPTIONS.RATING:
      return { ratingAverage: -1, ratingCount: -1 };
    case PRODUCT_SORT_OPTIONS.TITLE_ASC:
      return { title: 1 };
    case PRODUCT_SORT_OPTIONS.NEWEST:
    default:
      return { createdAt: -1 };
  }
}

export const productRepository = {
  async findPublic({ filters, sort, page, limit }) {
    const mongoFilter = buildPublicFilter(filters);
    const mongoSort = buildSort(sort);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find(mongoFilter)
        .sort(mongoSort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug')
        .populate('vendor', 'name'),
      Product.countDocuments(mongoFilter),
    ]);

    return { items, total };
  },

  async findManaged({ filters, sort, page, limit }) {
    const mongoFilter = buildManagedFilter(filters);
    const mongoSort = buildSort(sort);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find(mongoFilter)
        .sort(mongoSort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug')
        .populate('vendor', 'name email'),
      Product.countDocuments(mongoFilter),
    ]);

    return { items, total };
  },
};
