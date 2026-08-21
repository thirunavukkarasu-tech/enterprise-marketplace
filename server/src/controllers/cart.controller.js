import { cartService } from '../services/cartService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const cartController = {
  async getOwn(req, res) {
    const cart = await cartService.getOwnCart(req.user.id, { shippingMethod: req.query.shippingMethod });
    new ApiResponse(200, { cart }).send(res);
  },

  async addItem(req, res) {
    const cart = await cartService.addItem(req.user.id, req.body);
    new ApiResponse(200, { cart }, 'Added to cart').send(res);
  },

  async updateItem(req, res) {
    const cart = await cartService.updateItemQuantity(req.user.id, req.params.itemId, req.body.quantity);
    new ApiResponse(200, { cart }, 'Cart updated').send(res);
  },

  async removeItem(req, res) {
    const cart = await cartService.removeItem(req.user.id, req.params.itemId);
    new ApiResponse(200, { cart }, 'Item removed').send(res);
  },

  async clear(req, res) {
    const cart = await cartService.clearCart(req.user.id);
    new ApiResponse(200, { cart }, 'Cart cleared').send(res);
  },
};
