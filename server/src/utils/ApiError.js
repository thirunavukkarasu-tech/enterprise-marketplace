/**
 * Every intentional failure in the app (bad input, missing resource,
 * unauthorized access, etc.) should throw an ApiError rather than a plain
 * Error. The `isOperational` flag lets the central error handler tell the
 * difference between "expected, safe-to-explain-to-the-client" failures and
 * genuine bugs — which matters for deciding what's safe to leak in the
 * response body.
 */
export class ApiError extends Error {
  constructor(statusCode, message, { errors = [], isOperational = true, stack = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(400, message, { errors });
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(409, message);
  }

  static internal(message = 'Something went wrong on our end') {
    return new ApiError(500, message, { isOperational: false });
  }
}
