import { wishlistService } from '../services/wishlistService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const wishlistController = {
  async getOwn(req, res) {
    const products = await wishlistService.getOwn(req.user.id);
    new ApiResponse(200, { products }).send(res);
  },

  async add(req, res) {
    const products = await wishlistService.add(req.user.id, req.params.productId);
    new ApiResponse(200, { products }, 'Added to wishlist').send(res);
  },

  async remove(req, res) {
    const products = await wishlistService.remove(req.user.id, req.params.productId);
    new ApiResponse(200, { products }, 'Removed from wishlist').send(res);
  },
};
