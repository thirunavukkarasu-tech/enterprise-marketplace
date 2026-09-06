import { adminCustomerService } from '../services/adminCustomerService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const adminCustomerController = {
  async list(req, res) {
    const { items, ...meta } = await adminCustomerService.list(req.query);
    new ApiResponse(200, { customers: items }, 'Success', meta).send(res);
  },

  async getOne(req, res) {
    const customer = await adminCustomerService.getOne(req.params.id);
    new ApiResponse(200, { customer }).send(res);
  },
};
