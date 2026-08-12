import { apiClient } from '../../services/apiClient';
import type { Category } from '../../types/catalog';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const categoryApi = {
  async list(params: { tree?: boolean; includeInactive?: boolean } = {}) {
    const res = await apiClient.get<Envelope<{ categories: Category[] }>>('/categories', { params });
    return res.data.data.categories;
  },

  async getBySlug(slug: string) {
    const res = await apiClient.get<Envelope<{ category: Category }>>(`/categories/${slug}`);
    return res.data.data.category;
  },

  async create(payload: { name: string; description?: string; parent?: string | null }) {
    const res = await apiClient.post<Envelope<{ category: Category }>>('/categories', payload);
    return res.data.data.category;
  },

  async update(id: string, payload: Partial<{ name: string; description: string; parent: string | null; isActive: boolean }>) {
    const res = await apiClient.patch<Envelope<{ category: Category }>>(`/categories/${id}`, payload);
    return res.data.data.category;
  },

  async remove(id: string) {
    await apiClient.delete(`/categories/${id}`);
  },
};
