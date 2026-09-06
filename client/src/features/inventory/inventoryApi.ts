import { apiClient } from '../../services/apiClient';
import type { InventoryLedgerEntry, InventoryListQuery, InventoryRow } from '../../types/operations';
import type { PaginationMeta } from '../../types/order';

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

export const inventoryApi = {
  async list(query?: InventoryListQuery) {
    const res = await apiClient.get<Envelope<{ inventory: InventoryRow[] }>>(
      `/inventory${toQueryString(query as Record<string, unknown> | undefined)}`
    );
    return { items: res.data.data.inventory, meta: res.data.meta as PaginationMeta };
  },

  async history(productId: string, query?: { page?: number; limit?: number }) {
    const res = await apiClient.get<Envelope<{ history: InventoryLedgerEntry[] }>>(
      `/inventory/${productId}/history${toQueryString(query)}`
    );
    return { items: res.data.data.history, meta: res.data.meta as PaginationMeta };
  },

  async adjust(productId: string, payload: { sku: string; quantityChange: number; reason: string }) {
    const res = await apiClient.patch<Envelope<{ inventory: InventoryRow }>>(`/inventory/${productId}/adjust`, payload);
    return res.data.data.inventory;
  },
};
