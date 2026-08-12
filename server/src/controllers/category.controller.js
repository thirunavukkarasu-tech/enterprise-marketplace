import { categoryService } from '../services/category.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const categoryController = {
  async create(req, res) {
    const category = await categoryService.create(req.body);
    new ApiResponse(201, { category }, 'Category created').send(res);
  },

  async update(req, res) {
    const category = await categoryService.update(req.params.id, req.body);
    new ApiResponse(200, { category }, 'Category updated').send(res);
  },

  async remove(req, res) {
    await categoryService.delete(req.params.id);
    new ApiResponse(200, null, 'Category deleted').send(res);
  },

  async list(req, res) {
    const { tree, includeInactive } = req.query;
    const data = tree
      ? await categoryService.listAsTree({ includeInactive })
      : await categoryService.list({ includeInactive });
    new ApiResponse(200, { categories: data }).send(res);
  },

  async getBySlug(req, res) {
    const category = await categoryService.getBySlug(req.params.slug);
    new ApiResponse(200, { category }).send(res);
  },
};
