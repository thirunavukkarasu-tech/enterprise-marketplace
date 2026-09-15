import { apiClient } from '../../services/apiClient';
import type { Coupon, CouponInput, CouponListQuery } from '../../types/coupon';
import type { PaginationMeta } from '../../types/order';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

function toQueryString(query: CouponListQuery = {}): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const couponApi = {
  async list(query?: CouponListQuery) {
    const res = await apiClient.get<Envelope<{ coupons: Coupon[] }>>(`/admin/coupons${toQueryString(query)}`);
    return { coupons: res.data.data.coupons, meta: res.data.meta as PaginationMeta };
  },

  async getById(id: string) {
    const res = await apiClient.get<Envelope<{ coupon: Coupon }>>(`/admin/coupons/${id}`);
    return res.data.data.coupon;
  },

  async create(payload: CouponInput) {
    const res = await apiClient.post<Envelope<{ coupon: Coupon }>>('/admin/coupons', payload);
    return res.data.data.coupon;
  },

  async update(id: string, payload: Partial<CouponInput>) {
    const res = await apiClient.patch<Envelope<{ coupon: Coupon }>>(`/admin/coupons/${id}`, payload);
    return res.data.data.coupon;
  },

  async setActive(id: string, isActive: boolean) {
    const res = await apiClient.patch<Envelope<{ coupon: Coupon }>>(`/admin/coupons/${id}/status`, { isActive });
    return res.data.data.coupon;
  },

  async remove(id: string) {
    await apiClient.delete(`/admin/coupons/${id}`);
  },
};
