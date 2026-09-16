import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { isDev } from '../config/env.js';

// Maps a status code to a stable, machine-readable code a frontend can
// switch on without parsing the human-readable message — additive to the
// existing `message`/`errors` fields, not a replacement for them.
const ERROR_CODE_BY_STATUS = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

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

  // Malformed JSON body (body-parser/express.json throws a SyntaxError
  // with this shape) — a client mistake, not a server bug, so this
  // belongs at 400, not falling through to a generic 500.
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return new ApiError(400, 'Malformed JSON in request body');
  }

  // Request body exceeded the configured `express.json({ limit })`.
  // Also a client mistake: without this it falls through to a
  // non-operational 500, which both returns the wrong status and logs a
  // full stack trace for what is really just an oversized upload —
  // noise that would bury real errors, and a trivially remote-triggerable
  // way to flood the logs.
  if (err.type === 'entity.too.large' || err.status === 413) {
    return new ApiError(413, 'Request body is too large');
  }

  return new ApiError(500, 'Internal server error', { isOperational: false });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);
  const code = normalized.code ?? ERROR_CODE_BY_STATUS[normalized.statusCode] ?? 'INTERNAL_SERVER_ERROR';

  const logPayload = {
    requestId: req.id,
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

  const message = normalized.isOperational ? normalized.message : 'Something went wrong. Please try again later.';

  const body = {
    success: false,
    message,
    // `error` is additive — every existing field below it (`message`,
    // `errors`) stays exactly as it was before Phase 9, so no existing
    // frontend call site needs to change. New code can switch on
    // `error.code` instead of string-matching `message`.
    error: { code, message },
    ...(normalized.errors?.length ? { errors: normalized.errors } : {}),
    ...(isDev && !normalized.isOperational ? { stack: err.stack } : {}),
    requestId: req.id,
  };

  res.status(normalized.statusCode).json(body);
}
