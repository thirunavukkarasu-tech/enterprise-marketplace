import { apiClient } from '../../services/apiClient';
import type { Address, AddressInput } from '../../types/cart';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const addressApi = {
  async list() {
    const res = await apiClient.get<Envelope<{ addresses: Address[] }>>('/addresses');
    return res.data.data.addresses;
  },

  async create(payload: AddressInput) {
    const res = await apiClient.post<Envelope<{ address: Address }>>('/addresses', payload);
    return res.data.data.address;
  },

  async update(id: string, payload: Partial<AddressInput>) {
    const res = await apiClient.patch<Envelope<{ address: Address }>>(`/addresses/${id}`, payload);
    return res.data.data.address;
  },

  async remove(id: string) {
    await apiClient.delete(`/addresses/${id}`);
  },

  async setDefaultShipping(id: string) {
    const res = await apiClient.patch<Envelope<{ address: Address }>>(`/addresses/${id}/default-shipping`);
    return res.data.data.address;
  },

  async setDefaultBilling(id: string) {
    const res = await apiClient.patch<Envelope<{ address: Address }>>(`/addresses/${id}/default-billing`);
    return res.data.data.address;
  },
};
