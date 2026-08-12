import { ApiError } from '../utils/ApiError.js';

/**
 * Role check, applied after requireAuth on any route that needs it.
 * Deliberately separate from requireAuth — some routes need "logged in,
 * any role" (e.g. GET /auth/me) and others need a specific role, and
 * conflating the two into one middleware makes routes harder to read.
 *
 * This is the *role* boundary only. Resource-level ownership checks
 * (e.g. "this vendor can only edit their own products") are the
 * responsibility of the service layer once those domains exist — RBAC
 * here answers "can this role call this route at all," not "does this
 * specific user own this specific resource."
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}
