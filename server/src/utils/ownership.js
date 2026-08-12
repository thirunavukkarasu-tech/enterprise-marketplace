import { ROLES } from '../constants/roles.js';

/**
 * Answers "can this user manage this product" — true for a super admin
 * regardless of who owns it (moderation), true for the vendor who owns
 * it, false otherwise. Pure and DB-free so the rule itself is directly
 * unit-testable, independent of Express/Mongoose wiring.
 *
 * `product.vendor` may be an ObjectId, a populated User document, or a
 * plain string depending on the caller — normalized to a string before
 * comparing either way.
 */
export function canManageProduct(user, product) {
  if (!user || !product) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  if (user.role !== ROLES.VENDOR) return false;

  const ownerId = product.vendor?._id ?? product.vendor;
  return ownerId?.toString() === user.id?.toString();
}
