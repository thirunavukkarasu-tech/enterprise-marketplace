import { apiClient } from '../../services/apiClient';
import type { Category } from '../../types/catalog';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const categoryApi = {
  /** Public: active categories only. `withCounts` adds a `productCount`
   * per category (one aggregation server-side, not N+1 queries) — opt-in
   * since most callers (e.g. a form's category <select>) don't need it. */
  async list({ withCounts = false }: { withCounts?: boolean } = {}) {
    const res = await apiClient.get<Envelope<{ categories: Category[] }>>(
      `/categories${withCounts ? '?withCounts=true' : ''}`
    );
    return res.data.data.categories;
  },

  /** Admin-only: every category, active or not. */
  async listManaged() {
    const res = await apiClient.get<Envelope<{ categories: Category[] }>>('/categories/manage/all');
    return res.data.data.categories;
  },

  async getById(id: string) {
    const res = await apiClient.get<Envelope<{ category: Category }>>(`/categories/${id}`);
    return res.data.data.category;
  },

  async create(payload: { name: string; description?: string; parent?: string | null; image?: { url: string; alt?: string } }) {
    const res = await apiClient.post<Envelope<{ category: Category }>>('/categories', payload);
    return res.data.data.category;
  },

  async update(
    id: string,
    payload: Partial<{ name: string; description: string; parent: string | null; image: { url: string; alt?: string }; isActive: boolean }>
  ) {
    const res = await apiClient.patch<Envelope<{ category: Category }>>(`/categories/${id}`, payload);
    return res.data.data.category;
  },

  async remove(id: string) {
    await apiClient.delete(`/categories/${id}`);
  },
};
