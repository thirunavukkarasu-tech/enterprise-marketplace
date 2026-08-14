import { ROLES } from '../constants/roles.js';

/**
 * Route-level RBAC (`requireRole`) answers "can this role call this route
 * at all." It can't answer "does this vendor own this specific product" —
 * that's what this function is for, and it's the *only* place that rule
 * is implemented. Every mutating product/variant operation in
 * productService calls this before touching the database, so there's
 * exactly one function to audit for "can vendor B touch vendor A's
 * product," not one copy per controller action.
 */
export function canManageProduct(user, product) {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.role === ROLES.VENDOR && product.vendor.toString() === user.id;
}
