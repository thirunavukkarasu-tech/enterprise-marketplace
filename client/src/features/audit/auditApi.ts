import { apiClient } from '../../services/apiClient';
import type { AuditLogEntry } from '../../types/operations';
import type { PaginationMeta } from '../../types/order';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export const auditApi = {
  async list(query?: { actor?: string; action?: string; entityType?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const qs = params.toString();
    const res = await apiClient.get<Envelope<{ logs: AuditLogEntry[] }>>(`/audit-logs${qs ? `?${qs}` : ''}`);
    return { logs: res.data.data.logs, meta: res.data.meta as PaginationMeta };
  },
};
