import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { isDev } from '../config/env.js';

/**
 * Translates known error shapes (Mongoose, JWT, Zod-thrown, plain
 * ApiError) into a single ApiError so the response body is always the
 * same shape, then serializes it. Anything unrecognised is treated as a
 * non-operational 500 — its details are logged server-side but never sent
 * to the client, since an unexpected error could be leaking internals.
 */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return new ApiError(400, 'Validation failed', { errors });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new ApiError(409, `${field} already exists`);
  }

  // Mongoose bad ObjectId cast
  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid ${err.path}: ${err.value}`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return new ApiError(401, 'Invalid authentication token');
  }
  if (err.name === 'TokenExpiredError') {
    return new ApiError(401, 'Authentication token has expired');
  }

  // Zod validation errors thrown directly (rare — validators normally
  // convert these before they reach here, this is a safety net)
  if (err.name === 'ZodError') {
    const errors = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return new ApiError(400, 'Validation failed', { errors });
  }

  return new ApiError(500, 'Internal server error', { isOperational: false });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  const logPayload = {
    method: req.method,
    path: req.originalUrl,
    statusCode: normalized.statusCode,
    userId: req.user?.id,
  };

  if (normalized.isOperational) {
    logger.warn(normalized.message, logPayload);
  } else {
    // Non-operational = unexpected bug. Log the real error, not the
    // sanitized one, so it's actually debuggable.
    logger.error(err.message, { ...logPayload, stack: err.stack });
  }

  const body = {
    success: false,
    message: normalized.isOperational ? normalized.message : 'Something went wrong. Please try again later.',
    ...(normalized.errors?.length ? { errors: normalized.errors } : {}),
    ...(isDev && !normalized.isOperational ? { stack: err.stack } : {}),
  };

  res.status(normalized.statusCode).json(body);
}
