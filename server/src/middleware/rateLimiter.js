import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function handler(req, res, next) {
  next(new ApiError(429, 'Too many requests. Please try again later.'));
}

/**
 * General-purpose limiter applied to the whole API. Generous enough not to
 * bother normal browsing traffic.
 */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

/**
 * Tighter limiter reserved for auth endpoints (login, register, password
 * reset) in Phase 2 — brute-force and credential-stuffing targets need a
 * much smaller window than general API traffic.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
