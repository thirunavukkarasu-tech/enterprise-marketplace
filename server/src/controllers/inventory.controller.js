import { inventoryService } from '../services/inventoryService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const inventoryController = {
  async list(req, res) {
    const { items, ...meta } = await inventoryService.listManaged(req.user, req.query);
    new ApiResponse(200, { inventory: items }, 'Success', meta).send(res);
  },

  async history(req, res) {
    const { items, ...meta } = await inventoryService.history(req.user, req.params.productId, req.query);
    new ApiResponse(200, { history: items }, 'Success', meta).send(res);
  },

  async adjust(req, res) {
    const row = await inventoryService.adjust(req.user, req.params.productId, req.body);
    new ApiResponse(200, { inventory: row }, 'Stock adjusted').send(res);
  },
};
