import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { auditApi } from '../../features/audit/auditApi';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import type { AuditLogEntry } from '../../types/operations';
import type { PaginationMeta } from '../../types/order';

const ACTIONS = [
  'vendor.approved',
  'vendor.rejected',
  'vendor.suspended',
  'vendor.reactivated',
  'vendor.verified',
  'product.created',
  'product.updated',
  'product.status_changed',
  'inventory.adjusted',
  'order.created',
  'order.status_changed',
] as const;

const ENTITY_TYPES = ['Vendor', 'Product', 'Order'] as const;

function formatActionLabel(action: string) {
  return action.replace(/[._]/g, ' ');
}

export function AdminAuditLog() {
  const [query, setQuery] = useState<{ action?: string; entityType?: string; page: number; limit: number }>({
    page: 1,
    limit: 20,
  });
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    auditApi
      .list(query)
      .then(({ logs: data, meta: m }) => {
        setLogs(data);
        setMeta(m);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setError(anyErr.response?.data?.message ?? 'Failed to load the audit log.');
        setStatus('error');
      });
  };

  useEffect(load, [query]);

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-slate">Every tracked administrative and operational action on the platform.</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <select
          value={query.action ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, action: e.target.value || undefined, page: 1 }))}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {formatActionLabel(a)}
            </option>
          ))}
        </select>

        <select
          value={query.entityType ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, entityType: e.target.value || undefined, page: 1 }))}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
          aria-label="Filter by entity type"
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={load} />}

      {status === 'success' && logs.length === 0 && (
        <EmptyState icon={History} title="No activity found" description="Try clearing your filters." />
      )}

      {status === 'success' && logs.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((entry) => {
                  const actor = typeof entry.actor === 'string' ? null : entry.actor;
                  return (
                    <tr key={entry._id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{actor?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-slate">{actor?.email ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="indigo">{formatActionLabel(entry.action)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {entry.entityType} <span className="font-mono text-xs text-slate">{entry.entityId.slice(-8)}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate">
                        {Object.keys(entry.metadata).length > 0 ? JSON.stringify(entry.metadata) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{new Date(entry.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <div className="mt-6">
            <Pagination meta={meta} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
          </div>
        </>
      )}
    </div>
  );
}
