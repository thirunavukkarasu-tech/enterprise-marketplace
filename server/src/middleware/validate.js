import { ApiError } from '../utils/ApiError.js';

/**
 * Runs a Zod schema against { body, query, params } before the request
 * reaches a controller. Field-level errors are collected into a flat,
 * readable list rather than passing the raw ZodError through — the
 * client shouldn't need to understand Zod's issue-object shape.
 */
export function validate(schema) {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Replace with the parsed (and possibly coerced/defaulted) values.
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const errors = err.issues.map((issue) => `${issue.path.slice(1).join('.')}: ${issue.message}`);
        return next(ApiError.badRequest('Validation failed', errors));
      }
      next(err);
    }
  };
}
