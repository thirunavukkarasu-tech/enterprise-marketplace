/**
 * Every successful response in the API follows the same envelope:
 *   { success, message, data, meta? }
 * `meta` is reserved for pagination info (page/limit/total) added in
 * Phase 3+ so list endpoints don't need a second shape.
 */
export class ApiResponse {
  constructor(statusCode, data = null, message = 'Success', meta = undefined) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }

  send(res) {
    return res.status(this.statusCode).json(this);
  }
}
