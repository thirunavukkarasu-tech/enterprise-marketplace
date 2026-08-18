import { categoryService } from '../services/categoryService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const categoryController = {
  async list(req, res) {
    // Public: always active-only, regardless of any query the caller sends.
    // `withCounts` is the one opt-in exception — it only adds a
    // `productCount` field per category, it never changes which
    // categories are returned.
    const categories = await categoryService.list({ includeInactive: false, withCounts: req.query.withCounts });
    new ApiResponse(200, { categories }).send(res);
  },

  async listManaged(req, res) {
    // Admin-only route (requireRole enforces this before we get here) —
    // sees every category, active or not, for moderation/editing.
    const categories = await categoryService.list({ includeInactive: true });
    new ApiResponse(200, { categories }).send(res);
  },

  async getById(req, res) {
    const category = await categoryService.getById(req.params.id);
    new ApiResponse(200, { category }).send(res);
  },

  async create(req, res) {
    const category = await categoryService.create(req.body);
    new ApiResponse(201, { category }, 'Category created').send(res);
  },

  async update(req, res) {
    const category = await categoryService.update(req.params.id, req.body);
    new ApiResponse(200, { category }, 'Category updated').send(res);
  },

  async remove(req, res) {
    await categoryService.remove(req.params.id);
    new ApiResponse(200, null, 'Category deleted').send(res);
  },
};
