import { paymentService } from '../services/paymentService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const paymentController = {
  async initiate(req, res) {
    const payment = await paymentService.initiate(req.user, req.body);
    new ApiResponse(201, { payment }, 'Payment initiated').send(res);
  },

  async verify(req, res) {
    const payment = await paymentService.verify(req.user, req.params.id, req.body);
    const message = payment.status === 'paid' ? 'Payment successful' : 'Payment could not be completed';
    new ApiResponse(200, { payment }, message).send(res);
  },

  async getOwn(req, res) {
    const payment = await paymentService.getOwn(req.user, req.params.id);
    new ApiResponse(200, { payment }).send(res);
  },

  /**
   * No `req.user` here on purpose — a webhook call comes from the
   * payment provider's servers, not a logged-in customer, so this route
   * deliberately sits outside requireAuth (see payment.route.js). The
   * response body is intentionally minimal; a webhook caller checks the
   * HTTP status, not a human-readable envelope.
   */
  async webhook(req, res) {
    const result = await paymentService.processWebhookEvent(req.body);
    new ApiResponse(200, result, 'Webhook processed').send(res);
  },
};
