/**
 * Converts arbitrary text into a lowercase, URL-safe slug: strips
 * anything that isn't alphanumeric, collapses runs of separators into a
 * single hyphen, and trims leading/trailing hyphens.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
