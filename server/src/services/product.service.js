import { Product } from '../models/Product.model.js';
import { Category } from '../models/Category.model.js';
import { ApiError } from '../utils/ApiError.js';
import { generateUniqueSlug } from '../utils/slugify.js';
import { computePriceRange } from '../utils/pricing.js';
import { canManageProduct } from '../utils/ownership.js';
import { productRepository } from '../repositories/product.repository.js';
import { ROLES } from '../constants/roles.js';
import { PUBLIC_PRODUCT_STATUSES } from '../constants/product.js';

async function assertCategoryExists(categoryId) {
  const exists = await Category.exists({ _id: categoryId });
  if (!exists) throw ApiError.badRequest('Category not found');
}

/** Loads a product by id and throws 404/403 as appropriate for the given
 * caller — the one place every manage-scoped endpoint funnels through so
 * ownership is enforced identically everywhere, not re-implemented per
 * controller action. */
async function loadOwnedProduct(id, user) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');

  if (!canManageProduct(user, product)) {
    throw ApiError.forbidden('You do not have permission to manage this product');
  }
  return product;
}

export const productService = {
  async create({ vendorId, title, description, category, images, variants, status }) {
    await assertCategoryExists(category);

    const slug = await generateUniqueSlug(title, (candidate) => Product.exists({ slug: candidate }));
    const priceRange = computePriceRange(variants);

    const product = await Product.create({
      vendor: vendorId,
      title,
      description,
      category,
      images,
      variants,
      status,
      slug,
      priceRange,
    });

    return product;
  },

  async update(id, user, updates) {
    const product = await loadOwnedProduct(id, user);

    if (updates.category) {
      await assertCategoryExists(updates.category);
    }

    if (updates.title && updates.title !== product.title) {
      product.slug = await generateUniqueSlug(updates.title, (candidate) =>
        Product.exists({ slug: candidate, _id: { $ne: id } })
      );
    }

    Object.assign(product, updates);
    await product.save();
    return product;
  },

  async delete(id, user) {
    const product = await loadOwnedProduct(id, user);
    await product.deleteOne();
  },

  async getManagedById(id, user) {
    const product = await Product.findById(id).populate('category', 'name slug').populate('vendor', 'name email');
    if (!product) throw ApiError.notFound('Product not found');
    if (!canManageProduct(user, product)) {
      throw ApiError.forbidden('You do not have permission to view this product');
    }
    return product;
  },

  async getPublicBySlug(slug) {
    const product = await Product.findOne({ slug, status: { $in: PUBLIC_PRODUCT_STATUSES } })
      .populate('category', 'name slug')
      .populate('vendor', 'name');

    if (!product) throw ApiError.notFound('Product not found');
    return product;
  },

  async listPublic({ q, category, minPrice, maxPrice, sort, page, limit }) {
    const { items, total } = await productRepository.findPublic({
      filters: { q, category, minPrice, maxPrice },
      sort,
      page,
      limit,
    });
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  /**
   * Managed listing shared by both the vendor and admin dashboards. The
   * authorization decision — what `vendor` gets forced to — happens right
   * here, once, rather than trusting the controller or the query string:
   * a vendor's `vendor` filter is always overwritten with their own id,
   * no matter what was in the request, so there is no query-param path
   * that lets one vendor list another vendor's products.
   */
  async listManaged({ user, q, category, status, vendor, sort, page, limit }) {
    const scopedVendor = user.role === ROLES.SUPER_ADMIN ? vendor : user.id;

    const { items, total } = await productRepository.findManaged({
      filters: { q, category, status, vendor: scopedVendor },
      sort,
      page,
      limit,
    });
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  // ── Variant / SKU sub-resource operations ─────────────────────────────

  async addVariant(id, user, variant) {
    const product = await loadOwnedProduct(id, user);

    const skuTaken = await Product.exists({ 'variants.sku': variant.sku.toUpperCase() });
    if (skuTaken) throw ApiError.conflict(`SKU "${variant.sku}" is already in use`);

    product.variants.push(variant);
    product.priceRange = computePriceRange(product.variants);
    await product.save();
    return product;
  },

  async updateVariant(id, variantId, user, updates) {
    const product = await loadOwnedProduct(id, user);
    const variant = product.variants.id(variantId);
    if (!variant) throw ApiError.notFound('Variant not found');

    if (updates.sku && updates.sku.toUpperCase() !== variant.sku) {
      const skuTaken = await Product.exists({
        'variants.sku': updates.sku.toUpperCase(),
        _id: { $ne: product._id },
      });
      if (skuTaken) throw ApiError.conflict(`SKU "${updates.sku}" is already in use`);
    }

    Object.assign(variant, updates);
    product.priceRange = computePriceRange(product.variants);
    await product.save();
    return product;
  },

  async removeVariant(id, variantId, user) {
    const product = await loadOwnedProduct(id, user);
    const variant = product.variants.id(variantId);
    if (!variant) throw ApiError.notFound('Variant not found');

    if (product.variants.length === 1) {
      throw ApiError.badRequest('A product must have at least one variant — delete the product instead');
    }

    variant.deleteOne();
    product.priceRange = computePriceRange(product.variants);
    await product.save();
    return product;
  },
};
