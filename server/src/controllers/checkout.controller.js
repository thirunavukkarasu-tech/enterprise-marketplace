import { checkoutService } from '../services/checkoutService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const checkoutController = {
  async review(req, res) {
    const summary = await checkoutService.review(req.user.id, req.body);
    const message = summary.canProceed
      ? 'Checkout summary ready'
      : 'Some items in your cart need attention before you can continue';
    new ApiResponse(200, { checkout: summary }, message).send(res);
  },
};
