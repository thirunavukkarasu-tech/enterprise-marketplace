import { productService } from '../services/product.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';

function paginatedResponse({ items, total, page, limit, totalPages }, message) {
  return new ApiResponse(200, { products: items }, message, { page, limit, total, totalPages });
}

export const productController = {
  // ── Public storefront ────────────────────────────────────────────────
  async listPublic(req, res) {
    const result = await productService.listPublic(req.query);
    paginatedResponse(result).send(res);
  },

  async getPublicBySlug(req, res) {
    const product = await productService.getPublicBySlug(req.params.slug);
    new ApiResponse(200, { product }).send(res);
  },

  // ── Vendor / admin management ───────────────────────────────────────
  async listManaged(req, res) {
    const result = await productService.listManaged({ user: req.user, ...req.query });
    paginatedResponse(result).send(res);
  },

  async getManagedById(req, res) {
    const product = await productService.getManagedById(req.params.id, req.user);
    new ApiResponse(200, { product }).send(res);
  },

  async create(req, res) {
    const product = await productService.create({ vendorId: req.user.id, ...req.body });
    new ApiResponse(201, { product }, 'Product created').send(res);
  },

  async update(req, res) {
    const product = await productService.update(req.params.id, req.user, req.body);
    new ApiResponse(200, { product }, 'Product updated').send(res);
  },

  async remove(req, res) {
    await productService.delete(req.params.id, req.user);
    new ApiResponse(200, null, 'Product deleted').send(res);
  },

  // ── Variant / SKU sub-resource ──────────────────────────────────────
  async addVariant(req, res) {
    const product = await productService.addVariant(req.params.id, req.user, req.body);
    new ApiResponse(201, { product }, 'Variant added').send(res);
  },

  async updateVariant(req, res) {
    const product = await productService.updateVariant(req.params.id, req.params.variantId, req.user, req.body);
    new ApiResponse(200, { product }, 'Variant updated').send(res);
  },

  async removeVariant(req, res) {
    const product = await productService.removeVariant(req.params.id, req.params.variantId, req.user);
    new ApiResponse(200, { product }, 'Variant removed').send(res);
  },
};
