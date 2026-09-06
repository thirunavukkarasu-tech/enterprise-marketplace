import { apiClient } from '../../services/apiClient';
import type { Order, OrderListQuery, OrderStatus, PaginationMeta } from '../../types/order';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

function toQueryString(query: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const orderApi = {
  async createFromCart(payload: { shippingAddressId: string; billingAddressId?: string; shippingMethod?: string }) {
    const res = await apiClient.post<Envelope<{ order: Order }>>('/orders', payload);
    return res.data.data.order;
  },

  async listOwn(query?: { page?: number; limit?: number }) {
    const res = await apiClient.get<Envelope<{ orders: Order[] }>>(`/orders${toQueryString(query)}`);
    return { orders: res.data.data.orders, meta: res.data.meta as PaginationMeta };
  },

  async getOwn(id: string) {
    const res = await apiClient.get<Envelope<{ order: Order }>>(`/orders/${id}`);
    return res.data.data.order;
  },

  async listManaged(query?: OrderListQuery) {
    const res = await apiClient.get<Envelope<{ orders: Order[] }>>(
      `/orders/manage${toQueryString(query as Record<string, unknown> | undefined)}`
    );
    return { orders: res.data.data.orders, meta: res.data.meta as PaginationMeta };
  },

  async getManagedById(id: string) {
    const res = await apiClient.get<Envelope<{ order: Order }>>(`/orders/manage/${id}`);
    return res.data.data.order;
  },

  async updateStatus(id: string, status: OrderStatus, groupId?: string) {
    const res = await apiClient.patch<Envelope<{ order: Order }>>(`/orders/${id}/status`, { status, groupId });
    return res.data.data.order;
  },
};
