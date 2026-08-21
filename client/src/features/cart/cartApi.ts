import { apiClient } from '../../services/apiClient';
import type { Cart, ShippingMethod } from '../../types/cart';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const cartApi = {
  async getOwn(shippingMethod?: ShippingMethod) {
    const qs = shippingMethod ? `?shippingMethod=${shippingMethod}` : '';
    const res = await apiClient.get<Envelope<{ cart: Cart }>>(`/cart${qs}`);
    return res.data.data.cart;
  },

  async addItem(payload: { productId: string; sku: string; quantity?: number }) {
    const res = await apiClient.post<Envelope<{ cart: Cart }>>('/cart/items', payload);
    return res.data.data.cart;
  },

  async updateItemQuantity(itemId: string, quantity: number) {
    const res = await apiClient.patch<Envelope<{ cart: Cart }>>(`/cart/items/${itemId}`, { quantity });
    return res.data.data.cart;
  },

  async removeItem(itemId: string) {
    const res = await apiClient.delete<Envelope<{ cart: Cart }>>(`/cart/items/${itemId}`);
    return res.data.data.cart;
  },

  async clear() {
    const res = await apiClient.delete<Envelope<{ cart: Cart }>>('/cart');
    return res.data.data.cart;
  },
};
