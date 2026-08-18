import { apiClient } from '../../services/apiClient';
import type { Product } from '../../types/catalog';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const wishlistApi = {
  async getOwn() {
    const res = await apiClient.get<Envelope<{ products: Product[] }>>('/wishlist');
    return res.data.data.products;
  },

  async add(productId: string) {
    const res = await apiClient.post<Envelope<{ products: Product[] }>>(`/wishlist/${productId}`);
    return res.data.data.products;
  },

  async remove(productId: string) {
    const res = await apiClient.delete<Envelope<{ products: Product[] }>>(`/wishlist/${productId}`);
    return res.data.data.products;
  },
};
