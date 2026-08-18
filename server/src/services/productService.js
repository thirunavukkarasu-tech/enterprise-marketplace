import { Product } from '../models/Product.model.js';
import { Category } from '../models/Category.model.js';
import { Vendor } from '../models/Vendor.model.js';
import { productRepository } from '../repositories/product.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { generateUniqueSlug } from '../utils/uniqueSlug.js';
import { canManageProduct } from '../utils/ownership.js';
import { ROLES } from '../constants/roles.js';
import { PRODUCT_STATUS } from '../constants/product.js';

function recomputePriceRange(product) {
  const prices = product.variants.map((v) => v.price);
  product.priceRange = {
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
  };
}

/**
 * Attaches a customer-safe `vendorStore` summary to public product
 * responses — the storefront should say "Sold by Acme Supplies," not
 * show a raw vendor ObjectId. `Product.vendor` references `User` (see
 * docs/DATABASE.md for why), and the storefront-facing store name lives
 * on `Vendor`, so this is a lookup by `Vendor.user`, not a `.populate()`
 * on the `vendor` field itself — populating `vendor` would pull the
 * User document (name/email), not the store profile.
 *
 * Deliberately tolerant of a missing Vendor profile (`vendorStore: null`)
 * rather than filtering those products out: Phase 3 established that any
 * `vendor`-role account can list products once their account exists, and
 * changing that to require an *approved* Vendor profile is a write-path
 * policy decision for product creation/activation — out of scope for a
 * customer-facing read enrichment in Phase 5, and would invalidate
 * Phase 3's own approved test suite (which activates vendor products
 * without ever onboarding a Vendor profile for the owning account). See
 * docs/ARCHITECTURE.md for the fuller reasoning.
 */
async function attachVendorStores(products) {
  const list = Array.isArray(products) ? products : [products];
  const vendorUserIds = [...new Set(list.map((p) => p.vendor.toString()))];

  const vendors = await Vendor.find({ user: { $in: vendorUserIds } })
    .select('storeName logo isVerified user')
    .lean();
  const storeByUserId = new Map(vendors.map((v) => [v.user.toString(), v]));

  const enrich = (product) => {
    const store = storeByUserId.get(product.vendor.toString());
    return {
      ...product.toObject({ virtuals: true }),
      vendorStore: store
        ? { storeName: store.storeName, logo: store.logo ?? null, isVerified: store.isVerified }
        : null,
    };
  };

  const result = list.map(enrich);
  return Array.isArray(products) ? result : result[0];
}

async function assertCategoryExists(categoryId) {
  const exists = await Category.exists({ _id: categoryId });
  if (!exists) throw ApiError.badRequest('Category does not exist');
}

async function assertSkusAvailable(skus, { excludeProductId } = {}) {
  for (const sku of skus) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await productRepository.findBySku(sku, { excludeProductId });
    if (existing) {
      throw ApiError.conflict(`SKU "${sku.toUpperCase()}" is already in use by another product`);
    }
  }
}

async function loadManagedOrThrow(user, id) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  if (!canManageProduct(user, product)) {
    throw ApiError.forbidden('You do not have permission to manage this product');
  }
  return product;
}

export const productService = {
  // ── public storefront ────────────────────────────────────────────────
  async listPublic(query) {
    const result = await productRepository.list({ ...query, status: PRODUCT_STATUS.ACTIVE });
    return { ...result, items: await attachVendorStores(result.items) };
  },

  async getPublicBySlug(slug) {
    const product = await productRepository.findBySlug(slug);
    if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
      throw ApiError.notFound('Product not found');
    }
    return attachVendorStores(product);
  },

  // ── vendor / admin management ───────────────────────────────────────
  async listManaged(user, query) {
    // A vendor's own scope is forced server-side and can never be
    // overridden by the query string — see docs/SECURITY.md §2.
    const vendor = user.role === ROLES.SUPER_ADMIN ? query.vendor : user.id;
    return productRepository.list({ ...query, vendor });
  },

  async getManagedById(user, id) {
    return loadManagedOrThrow(user, id);
  },

  async create(user, payload) {
    await assertCategoryExists(payload.category);

    const vendor = user.role === ROLES.SUPER_ADMIN ? payload.vendor : user.id;
    if (!vendor) {
      throw ApiError.badRequest('vendor is required when an admin creates a product');
    }

    const skus = payload.variants.map((v) => v.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw ApiError.badRequest('Duplicate SKUs within the same product are not allowed');
    }
    await assertSkusAvailable(skus);

    const slug = await generateUniqueSlug(Product, payload.title);

    const product = new Product({
      vendor,
      category: payload.category,
      title: payload.title,
      description: payload.description,
      images: payload.images ?? [],
      variants: payload.variants,
      slug,
    });
    recomputePriceRange(product);

    await product.save();
    return product;
  },

  async update(user, id, payload) {
    const product = await loadManagedOrThrow(user, id);

    if (payload.category !== undefined) {
      await assertCategoryExists(payload.category);
      product.category = payload.category;
    }
    // Slug is intentionally NOT regenerated on title changes — a stable
    // slug means product URLs don't silently break after an edit.
    if (payload.title !== undefined) product.title = payload.title;
    if (payload.description !== undefined) product.description = payload.description;
    if (payload.images !== undefined) product.images = payload.images;

    await product.save();
    return product;
  },

  async updateStatus(user, id, status) {
    const product = await loadManagedOrThrow(user, id);

    if (status === PRODUCT_STATUS.ACTIVE && product.variants.length === 0) {
      throw ApiError.badRequest('A product needs at least one variant before it can go active');
    }

    product.status = status;
    await product.save();
    return product;
  },

  async remove(user, id) {
    const product = await loadManagedOrThrow(user, id);
    await product.deleteOne();
  },

  // ── variants ─────────────────────────────────────────────────────────
  async addVariant(user, id, variantPayload) {
    const product = await loadManagedOrThrow(user, id);
    const sku = variantPayload.sku.toUpperCase();

    if (product.variants.some((v) => v.sku === sku)) {
      throw ApiError.conflict(`SKU "${sku}" already exists on this product`);
    }
    await assertSkusAvailable([sku], { excludeProductId: product._id });

    product.variants.push({ ...variantPayload, sku });
    recomputePriceRange(product);
    await product.save();
    return product;
  },

  async updateVariant(user, id, sku, payload) {
    const product = await loadManagedOrThrow(user, id);
    const variant = product.variants.find((v) => v.sku === sku.toUpperCase());
    if (!variant) throw ApiError.notFound('Variant not found on this product');

    if (payload.price !== undefined) variant.price = payload.price;
    if (payload.compareAtPrice !== undefined) variant.compareAtPrice = payload.compareAtPrice;
    if (payload.stock !== undefined) variant.stock = payload.stock;
    if (payload.attributes !== undefined) variant.attributes = payload.attributes;

    recomputePriceRange(product);
    await product.save();
    return product;
  },

  async removeVariant(user, id, sku) {
    const product = await loadManagedOrThrow(user, id);
    const target = sku.toUpperCase();

    if (product.variants.length === 1 && product.variants[0].sku === target) {
      throw ApiError.badRequest('A product must have at least one variant — delete the product instead');
    }

    const originalLength = product.variants.length;
    product.variants = product.variants.filter((v) => v.sku !== target);
    if (product.variants.length === originalLength) {
      throw ApiError.notFound('Variant not found on this product');
    }

    recomputePriceRange(product);
    await product.save();
    return product;
  },
};
