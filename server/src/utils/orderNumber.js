import { Order } from '../models/Order.model.js';

/**
 * Human-readable order numbers (e.g. "ORD-20260825-4F2A") rather than
 * exposing the raw Mongo _id as the customer-facing identifier — the
 * same reasoning products/categories use `slug` for public URLs instead
 * of their _id. Collision-checked against the unique index rather than
 * assumed unique by construction, since the random suffix is short.
 */
export async function generateOrderNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidate = `ORD-${datePart}-${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Order.exists({ orderNumber: candidate });
    if (!exists) return candidate;
  }
}
