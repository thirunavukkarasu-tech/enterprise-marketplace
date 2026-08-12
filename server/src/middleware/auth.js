import { verifyAccessToken } from '../utils/tokenService.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Verifies the access token from the Authorization header and attaches
 * `req.user`. Also re-checks the user's active status against the DB on
 * every request (a small extra query) rather than trusting the token's
 * `role` claim for the token's full 15-minute lifetime — a deactivated
 * account or an admin's role change should take effect immediately, not
 * up to 15 minutes later.
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication required');
  }

  const token = header.slice('Bearer '.length);

  // jwt.verify throws JsonWebTokenError/TokenExpiredError, which
  // errorHandler already normalizes to a 401 — no try/catch needed here.
  const payload = verifyAccessToken(token);

  const user = await User.findById(payload.sub).select('role isActive').lean();
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is no longer active');
  }

  req.user = { id: payload.sub, role: user.role };
  next();
});
