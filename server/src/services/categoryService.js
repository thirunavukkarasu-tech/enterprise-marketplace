import { Category } from '../models/Category.model.js';
import { Product } from '../models/Product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { generateUniqueSlug } from '../utils/uniqueSlug.js';

const MAX_PARENT_CHAIN_DEPTH = 20; // sane ceiling against a corrupted/cyclic chain

async function assertNoCycle(categoryId, proposedParentId) {
  if (!proposedParentId) return;
  if (proposedParentId.toString() === categoryId?.toString()) {
    throw ApiError.badRequest('A category cannot be its own parent');
  }

  let current = proposedParentId;
  for (let depth = 0; depth < MAX_PARENT_CHAIN_DEPTH; depth += 1) {
    // eslint-disable-next-line no-await-in-loop
    const parent = await Category.findById(current).select('parent').lean();
    if (!parent) return; // reached the top (or a dangling ref, which isn't this function's problem)
    if (!parent.parent) return;
    if (parent.parent.toString() === categoryId?.toString()) {
      throw ApiError.badRequest('This would create a circular category hierarchy');
    }
    current = parent.parent;
  }
}

export const categoryService = {
  async list({ includeInactive = false } = {}) {
    const filter = includeInactive ? {} : { isActive: true };
    return Category.find(filter).sort({ name: 1 });
  },

  async getById(id) {
    const category = await Category.findById(id);
    if (!category) throw ApiError.notFound('Category not found');
    return category;
  },

  async create({ name, description, parent, image }) {
    if (parent) {
      const parentExists = await Category.exists({ _id: parent });
      if (!parentExists) throw ApiError.badRequest('Parent category does not exist');
    }

    const slug = await generateUniqueSlug(Category, name);
    return Category.create({ name, description, parent: parent ?? null, image, slug });
  },

  async update(id, { name, description, parent, image, isActive }) {
    const category = await this.getById(id);

    if (parent !== undefined) {
      if (parent) {
        const parentExists = await Category.exists({ _id: parent });
        if (!parentExists) throw ApiError.badRequest('Parent category does not exist');
      }
      await assertNoCycle(category._id, parent);
      category.parent = parent ?? null;
    }

    if (name !== undefined && name !== category.name) {
      category.name = name;
      category.slug = await generateUniqueSlug(Category, name, { excludeId: category._id });
    }
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    return category;
  },

  async remove(id) {
    const category = await this.getById(id);

    const [hasChildren, hasProducts] = await Promise.all([
      Category.exists({ parent: category._id }),
      Product.exists({ category: category._id }),
    ]);

    if (hasChildren) {
      throw ApiError.conflict('This category has subcategories and cannot be deleted');
    }
    if (hasProducts) {
      throw ApiError.conflict('This category has products assigned to it and cannot be deleted');
    }

    await category.deleteOne();
  },
};
