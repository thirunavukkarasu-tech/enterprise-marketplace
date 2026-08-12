/**
 * Converts a title into a URL-safe slug base. Uniqueness (appending
 * -2, -3, ...) is the caller's responsibility since only the caller knows
 * which collection/scope to check against — kept here as a pure string
 * transform so it's trivially unit-testable without touching the DB.
 */
export function slugify(input) {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Generates a unique slug by appending -2, -3, ... until `exists` (an
 * async predicate checking the DB) returns false. Small bound on attempts
 * so a pathological case can't loop forever.
 */
export async function generateUniqueSlug(base, exists) {
  const root = slugify(base) || 'item';
  let candidate = root;
  let attempt = 1;

  while (await exists(candidate)) {
    attempt += 1;
    candidate = `${root}-${attempt}`;
    if (attempt > 50) {
      candidate = `${root}-${Date.now()}`;
      break;
    }
  }

  return candidate;
}
