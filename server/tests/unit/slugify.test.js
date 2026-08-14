import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../../src/utils/slugify.js';
import { generateUniqueSlug } from '../../src/utils/uniqueSlug.js';

test('slugify lowercases and hyphenates a normal title', () => {
  assert.equal(slugify('Wireless Bluetooth Headphones'), 'wireless-bluetooth-headphones');
});

test('slugify strips accents to their base characters', () => {
  assert.equal(slugify('Café Crème Brûlée'), 'cafe-creme-brulee');
});

test('slugify collapses repeated separators and trims edges', () => {
  assert.equal(slugify('  --Multiple   Spaces--  '), 'multiple-spaces');
});

test('slugify strips punctuation that is not alphanumeric', () => {
  assert.equal(slugify("Men's Running Shoes (2024)!"), 'men-s-running-shoes-2024');
});

// ── generateUniqueSlug ──────────────────────────────────────────────────

function makeFakeModel(existingSlugs) {
  return {
    async exists({ slug, _id }) {
      const excluded = _id?.$ne;
      const taken = existingSlugs.some((entry) => entry.slug === slug && entry._id !== excluded);
      return taken ? { _id: 'x' } : null;
    },
  };
}

test('generateUniqueSlug returns the base slug when nothing collides', async () => {
  const Model = makeFakeModel([]);
  const slug = await generateUniqueSlug(Model, 'Fresh Product Title');
  assert.equal(slug, 'fresh-product-title');
});

test('generateUniqueSlug appends -2, -3 on collisions', async () => {
  const Model = makeFakeModel([
    { slug: 'duplicate-title', _id: 'a' },
    { slug: 'duplicate-title-2', _id: 'b' },
  ]);
  const slug = await generateUniqueSlug(Model, 'Duplicate Title');
  assert.equal(slug, 'duplicate-title-3');
});

test('generateUniqueSlug excludes the document being updated from the collision check', async () => {
  const Model = makeFakeModel([{ slug: 'my-title', _id: 'self-id' }]);
  const slug = await generateUniqueSlug(Model, 'My Title', { excludeId: 'self-id' });
  // Excluding its own id means the only match found is itself, so the
  // base slug is considered free — renaming back to the same slug works.
  assert.equal(slug, 'my-title');
});
