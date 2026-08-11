/**
 * Wraps an async Express handler so any thrown/rejected error is forwarded
 * to `next()` automatically. Keeps controllers thin — no repeated
 * try/catch boilerplate in every route.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
