import { apiClient } from '../../services/apiClient';
import type { PaginationMeta } from '../../types/catalog';
import type { Vendor, VendorDashboard, VendorListQuery, VendorProfileInput } from '../../types/vendor';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

interface VendorListResult {
  vendors: Vendor[];
  meta: PaginationMeta;
}

function toQueryString(query: VendorListQuery = {}): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const vendorApi = {
  // ── self-service (vendor role) ──────────────────────────────────────
  async createOwnProfile(payload: VendorProfileInput) {
    const res = await apiClient.post<Envelope<{ vendor: Vendor }>>('/vendors/me', payload);
    return res.data.data.vendor;
  },

  async getOwnProfile() {
    const res = await apiClient.get<Envelope<{ vendor: Vendor }>>('/vendors/me');
    return res.data.data.vendor;
  },

  async updateOwnProfile(payload: Partial<VendorProfileInput>) {
    const res = await apiClient.patch<Envelope<{ vendor: Vendor }>>('/vendors/me', payload);
    return res.data.data.vendor;
  },

  async getOwnDashboard() {
    const res = await apiClient.get<Envelope<VendorDashboard>>('/vendors/me/dashboard');
    return res.data.data;
  },

  // ── admin management ────────────────────────────────────────────────
  async listAll(query?: VendorListQuery): Promise<VendorListResult> {
    const res = await apiClient.get<Envelope<{ vendors: Vendor[] }>>(`/vendors${toQueryString(query)}`);
    return { vendors: res.data.data.vendors, meta: res.data.meta as PaginationMeta };
  },

  async getById(id: string) {
    const res = await apiClient.get<Envelope<{ vendor: Vendor }>>(`/vendors/${id}`);
    return res.data.data.vendor;
  },

  async approve(id: string) {
    const res = await apiClient.patch<Envelope<{ vendor: Vendor }>>(`/vendors/${id}/approve`);
    return res.data.data.vendor;
  },

  async reject(id: string, reason: string) {
    const res = await apiClient.patch<Envelope<{ vendor: Vendor }>>(`/vendors/${id}/reject`, { reason });
    return res.data.data.vendor;
  },

  async suspend(id: string, reason?: string) {
    const res = await apiClient.patch<Envelope<{ vendor: Vendor }>>(`/vendors/${id}/suspend`, { reason });
    return res.data.data.vendor;
  },

  async reactivate(id: string) {
    const res = await apiClient.patch<Envelope<{ vendor: Vendor }>>(`/vendors/${id}/reactivate`);
    return res.data.data.vendor;
  },

  async setVerification(id: string, isVerified: boolean) {
    const res = await apiClient.patch<Envelope<{ vendor: Vendor }>>(`/vendors/${id}/verify`, { isVerified });
    return res.data.data.vendor;
  },
};
