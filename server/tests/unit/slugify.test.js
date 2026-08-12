import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, generateUniqueSlug } from '../../src/utils/slugify.js';

test('slugify lowercases, strips punctuation, and hyphenates', () => {
  assert.equal(slugify('Wireless Headphones — Pro Max!'), 'wireless-headphones-pro-max');
  assert.equal(slugify('  Trailing Spaces  '), 'trailing-spaces');
  assert.equal(slugify('UPPER_CASE Title'), 'upper-case-title');
});

test('slugify collapses repeated separators', () => {
  assert.equal(slugify('A///B   C'), 'a-b-c');
});

test('generateUniqueSlug returns the base slug when it is free', async () => {
  const slug = await generateUniqueSlug('Cool Product', async () => false);
  assert.equal(slug, 'cool-product');
});

test('generateUniqueSlug appends a numeric suffix on collision', async () => {
  const taken = new Set(['cool-product', 'cool-product-2']);
  const slug = await generateUniqueSlug('Cool Product', async (candidate) => taken.has(candidate));
  assert.equal(slug, 'cool-product-3');
});

test('generateUniqueSlug falls back to a timestamp suffix after many collisions', async () => {
  const slug = await generateUniqueSlug('Popular', async () => true);
  assert.ok(slug.startsWith('popular-'));
  assert.notEqual(slug, 'popular');
});
