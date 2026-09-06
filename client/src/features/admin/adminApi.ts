import { apiClient } from '../../services/apiClient';
import type { AdminCustomerDetail, AdminCustomerRow, AdminDashboardOverview } from '../../types/operations';
import type { PaginationMeta } from '../../types/order';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export const adminApi = {
  async getDashboardOverview() {
    const res = await apiClient.get<Envelope<{ overview: AdminDashboardOverview }>>('/admin/dashboard/overview');
    return res.data.data.overview;
  },

  async listCustomers(query?: { q?: string; isActive?: boolean; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const qs = params.toString();
    const res = await apiClient.get<Envelope<{ customers: AdminCustomerRow[] }>>(`/admin/customers${qs ? `?${qs}` : ''}`);
    return { customers: res.data.data.customers, meta: res.data.meta as PaginationMeta };
  },

  async getCustomer(id: string) {
    const res = await apiClient.get<Envelope<{ customer: AdminCustomerDetail }>>(`/admin/customers/${id}`);
    return res.data.data.customer;
  },
};
