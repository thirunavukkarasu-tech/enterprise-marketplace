import { productService } from '../services/productService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const productController = {
  // ── public ───────────────────────────────────────────────────────────
  async listPublic(req, res) {
    const { items, ...meta } = await productService.listPublic(req.query);
    new ApiResponse(200, { products: items }, 'Success', meta).send(res);
  },

  async getPublicBySlug(req, res) {
    const product = await productService.getPublicBySlug(req.params.slug);
    new ApiResponse(200, { product }).send(res);
  },

  // ── managed (vendor + admin) ────────────────────────────────────────
  async listManaged(req, res) {
    const { items, ...meta } = await productService.listManaged(req.user, req.query);
    new ApiResponse(200, { products: items }, 'Success', meta).send(res);
  },

  async getManagedById(req, res) {
    const product = await productService.getManagedById(req.user, req.params.id);
    new ApiResponse(200, { product }).send(res);
  },

  async create(req, res) {
    const product = await productService.create(req.user, req.body);
    new ApiResponse(201, { product }, 'Product created').send(res);
  },

  async update(req, res) {
    const product = await productService.update(req.user, req.params.id, req.body);
    new ApiResponse(200, { product }, 'Product updated').send(res);
  },

  async updateStatus(req, res) {
    const product = await productService.updateStatus(req.user, req.params.id, req.body.status);
    new ApiResponse(200, { product }, 'Product status updated').send(res);
  },

  async remove(req, res) {
    await productService.remove(req.user, req.params.id);
    new ApiResponse(200, null, 'Product deleted').send(res);
  },

  async addVariant(req, res) {
    const product = await productService.addVariant(req.user, req.params.id, req.body);
    new ApiResponse(201, { product }, 'Variant added').send(res);
  },

  async updateVariant(req, res) {
    const product = await productService.updateVariant(req.user, req.params.id, req.params.sku, req.body);
    new ApiResponse(200, { product }, 'Variant updated').send(res);
  },

  async removeVariant(req, res) {
    const product = await productService.removeVariant(req.user, req.params.id, req.params.sku);
    new ApiResponse(200, { product }, 'Variant removed').send(res);
  },
};
