import { useState, Fragment } from 'react';
import { useEffect } from 'react';
import { Boxes, ChevronDown, ChevronUp, History } from 'lucide-react';
import { inventoryApi } from '../../features/inventory/inventoryApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import type { InventoryLedgerEntry, InventoryListQuery, InventoryRow, StockStatus } from '../../types/operations';

const STATUS_TONE: Record<StockStatus, 'emerald' | 'marigold' | 'coral'> = {
  in_stock: 'emerald',
  low_stock: 'marigold',
  out_of_stock: 'coral',
};

const STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

function AdjustForm({ row, onDone }: { row: InventoryRow; onDone: () => void }) {
  const [quantityChange, setQuantityChange] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = Number(quantityChange);
    if (!Number.isInteger(parsed) || parsed === 0) {
      setError('Enter a non-zero whole number (negative to remove stock).');
      return;
    }
    if (reason.trim().length < 3) {
      setError('A short reason is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await inventoryApi.adjust(row.productId, { sku: row.sku, quantityChange: parsed, reason: reason.trim() });
      setQuantityChange('');
      setReason('');
      onDone();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr.response?.data?.message ?? 'Could not adjust stock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-soft" htmlFor={`qty-${row.sku}`}>
          Change
        </label>
        <Input
          id={`qty-${row.sku}`}
          className="w-24"
          placeholder="+10 / -3"
          value={quantityChange}
          onChange={(e) => setQuantityChange(e.target.value)}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-ink-soft" htmlFor={`reason-${row.sku}`}>
          Reason
        </label>
        <Input
          id={`reason-${row.sku}`}
          placeholder="Restock, damaged, recount…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button size="sm" onClick={submit} disabled={submitting}>
        {submitting ? 'Saving…' : 'Apply'}
      </Button>
      {error && <p className="basis-full text-xs text-coral-600">{error}</p>}
    </div>
  );
}

function HistoryPanel({ row }: { row: InventoryRow }) {
  const [entries, setEntries] = useState<InventoryLedgerEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    inventoryApi
      .history(row.productId, { limit: 10 })
      .then(({ items }) => {
        setEntries(items);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [row.productId]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }
  if (status === 'error') return <p className="text-xs text-coral-600">Could not load history.</p>;
  if (entries.length === 0) return <p className="text-xs text-slate">No adjustments recorded yet for this SKU.</p>;

  return (
    <ul className="space-y-1.5">
      {entries.map((entry) => {
        const performer = typeof entry.performedBy === 'string' ? null : entry.performedBy;
        return (
          <li key={entry._id} className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">
              <span className={entry.quantityChange >= 0 ? 'font-mono text-emerald-600' : 'font-mono text-coral-600'}>
                {entry.quantityChange >= 0 ? '+' : ''}
                {entry.quantityChange}
              </span>{' '}
              → {entry.resultingStock} in stock
              {entry.reason && <span className="text-slate"> · {entry.reason}</span>}
              {performer && <span className="text-slate"> · {performer.name}</span>}
            </span>
            <span className="shrink-0 font-mono text-slate">{new Date(entry.createdAt).toLocaleDateString()}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Inventory({ scope = 'vendor' }: { scope?: 'admin' | 'vendor' } = {}) {
  const [query, setQuery] = useState<InventoryListQuery>({ page: 1, limit: 15 });
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    inventoryApi
      .list(query)
      .then(({ items, meta: m }) => {
        setRows(items);
        setMeta(m);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setError(anyErr.response?.data?.message ?? 'Failed to load inventory.');
        setStatus('error');
      });
  };

  useEffect(load, [query]);

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-slate">
          {scope === 'admin'
            ? 'Stock across every vendor. Adjustments are logged with a reason and timestamp.'
            : 'Your product stock. Adjustments are logged with a reason and timestamp.'}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <select
          value={query.stockStatus ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, stockStatus: (e.target.value || undefined) as StockStatus | undefined, page: 1 }))}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
          aria-label="Filter by stock status"
        >
          <option value="">All stock levels</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={load} />}

      {status === 'success' && rows.length === 0 && (
        <EmptyState icon={Boxes} title="No inventory to show" description="Try clearing your filters." />
      )}

      {status === 'success' && rows.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Reserved</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => {
                  const rowKey = `${row.productId}-${row.sku}`;
                  const expanded = expandedSku === rowKey;
                  return (
                    <Fragment key={rowKey}>
                      <tr>
                        <td className="px-4 py-3 font-medium text-ink">{row.productTitle}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-soft">{row.sku}</td>
                        <td className="px-4 py-3 font-mono text-ink-soft">{row.stock}</td>
                        <td className="px-4 py-3 font-mono text-ink-soft">{row.reservedStock}</td>
                        <td className="px-4 py-3 font-mono text-ink-soft">{row.availableStock}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[row.stockStatus]}>{STATUS_LABEL[row.stockStatus]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedSku(expanded ? null : rowKey)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-slate-100"
                            aria-label="Toggle adjustment panel"
                          >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={7} className="border-t border-slate-200 bg-slate-100 px-4 py-4">
                            <AdjustForm row={row} onDone={load} />
                            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate">
                              <History size={12} /> Recent history
                            </div>
                            <div className="mt-2">
                              <HistoryPanel row={row} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
