import { Category } from '../models/Category.model.js';
import { Product } from '../models/Product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { generateUniqueSlug } from '../utils/slugify.js';

function buildTree(categories) {
  const byId = new Map(categories.map((c) => [c._id.toString(), { ...c.toJSON(), children: [] }]));
  const roots = [];

  for (const category of byId.values()) {
    if (category.parent) {
      const parent = byId.get(category.parent.toString());
      if (parent) {
        parent.children.push(category);
        continue;
      }
    }
    roots.push(category);
  }

  return roots;
}

export const categoryService = {
  async create({ name, description, parent, image }) {
    if (parent) {
      const parentExists = await Category.exists({ _id: parent });
      if (!parentExists) throw ApiError.badRequest('Parent category not found');
    }

    const slug = await generateUniqueSlug(name, (candidate) => Category.exists({ slug: candidate }));

    return Category.create({ name, description, parent, image, slug });
  },

  async update(id, updates) {
    const category = await Category.findById(id);
    if (!category) throw ApiError.notFound('Category not found');

    if (updates.parent) {
      if (updates.parent === id) {
        throw ApiError.badRequest('A category cannot be its own parent');
      }
      const parentExists = await Category.exists({ _id: updates.parent });
      if (!parentExists) throw ApiError.badRequest('Parent category not found');
    }

    if (updates.name && updates.name !== category.name) {
      category.slug = await generateUniqueSlug(updates.name, (candidate) =>
        Category.exists({ slug: candidate, _id: { $ne: id } })
      );
    }

    Object.assign(category, updates);
    await category.save();
    return category;
  },

  async delete(id) {
    const category = await Category.findById(id);
    if (!category) throw ApiError.notFound('Category not found');

    const hasChildren = await Category.exists({ parent: id });
    if (hasChildren) {
      throw ApiError.conflict('Cannot delete a category that has subcategories — remove or reassign them first');
    }

    const hasProducts = await Product.exists({ category: id });
    if (hasProducts) {
      throw ApiError.conflict('Cannot delete a category that has products — reassign or remove them first');
    }

    await category.deleteOne();
  },

  async list({ includeInactive = false } = {}) {
    const filter = includeInactive ? {} : { isActive: true };
    return Category.find(filter).sort({ name: 1 });
  },

  async listAsTree({ includeInactive = false } = {}) {
    const categories = await this.list({ includeInactive });
    return buildTree(categories);
  },

  async getBySlug(slug) {
    const category = await Category.findOne({ slug });
    if (!category) throw ApiError.notFound('Category not found');
    return category;
  },

  async getById(id) {
    const category = await Category.findById(id);
    if (!category) throw ApiError.notFound('Category not found');
    return category;
  },
};
