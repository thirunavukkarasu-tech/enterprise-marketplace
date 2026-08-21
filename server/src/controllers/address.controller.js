import { addressService } from '../services/addressService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const addressController = {
  async list(req, res) {
    const addresses = await addressService.list(req.user.id);
    new ApiResponse(200, { addresses }).send(res);
  },

  async getOne(req, res) {
    const address = await addressService.getOne(req.user.id, req.params.id);
    new ApiResponse(200, { address }).send(res);
  },

  async create(req, res) {
    const address = await addressService.create(req.user.id, req.body);
    new ApiResponse(201, { address }, 'Address added').send(res);
  },

  async update(req, res) {
    const address = await addressService.update(req.user.id, req.params.id, req.body);
    new ApiResponse(200, { address }, 'Address updated').send(res);
  },

  async remove(req, res) {
    await addressService.remove(req.user.id, req.params.id);
    new ApiResponse(200, null, 'Address deleted').send(res);
  },

  async setDefaultShipping(req, res) {
    const address = await addressService.setDefaultShipping(req.user.id, req.params.id);
    new ApiResponse(200, { address }, 'Default shipping address updated').send(res);
  },

  async setDefaultBilling(req, res) {
    const address = await addressService.setDefaultBilling(req.user.id, req.params.id);
    new ApiResponse(200, { address }, 'Default billing address updated').send(res);
  },
};
