import { slugify } from './slugify.js';

/**
 * Generates a slug from `text` and appends `-2`, `-3`, ... until it's
 * unique for the given Mongoose model. Shared between Category and
 * Product services rather than duplicated — both need exactly this same
 * "slugify, then resolve collisions" behavior.
 */
export async function generateUniqueSlug(Model, text, { excludeId } = {}) {
  const base = slugify(text) || 'item';
  let slug = base;
  let counter = 2;

  // eslint-disable-next-line no-await-in-loop
  while (await Model.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}
