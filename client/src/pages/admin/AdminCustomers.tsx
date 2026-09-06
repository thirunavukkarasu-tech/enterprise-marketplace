import { useState, useEffect, Fragment } from 'react';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { adminApi } from '../../features/admin/adminApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency } from '../../utils/formatCurrency';
import type { AdminCustomerDetail, AdminCustomerRow } from '../../types/operations';

function CustomerDetailPanel({ customerId }: { customerId: string }) {
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getCustomer(customerId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex justify-center border-t border-slate-200 bg-slate-100 py-6">
        <Spinner />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="border-t border-slate-200 bg-slate-100 p-5 text-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">Recent orders</p>
      {detail.recentOrders.length === 0 ? (
        <p className="text-ink-soft">No orders yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {detail.recentOrders.map((o) => (
            <li key={o.orderId} className="flex items-center justify-between px-3 py-2">
              <span className="font-mono text-xs text-ink">{o.orderNumber}</span>
              <span className="text-xs text-slate">{new Date(o.createdAt).toLocaleDateString()}</span>
              <span className="font-mono text-xs font-semibold text-ink">{formatCurrency(o.grandTotal)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [query, setQuery] = useState<{ q?: string; isActive?: boolean; page: number; limit: number }>({
    page: 1,
    limit: 10,
  });
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    adminApi
      .listCustomers(query)
      .then(({ customers: data, meta: m }) => {
        setCustomers(data);
        setMeta(m);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setError(anyErr.response?.data?.message ?? 'Failed to load customers.');
        setStatus('error');
      });
  };

  useEffect(load, [query]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((q) => ({ ...q, q: searchInput || undefined, page: 1 }));
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-slate">Every customer account, with real order activity.</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={submitSearch} className="flex max-w-sm flex-1 gap-2">
          <Input
            placeholder="Search name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search customers"
          />
          <button type="submit" className="rounded-md border border-slate-200 px-3 text-sm text-ink-soft hover:bg-slate-100">
            Search
          </button>
        </form>

        <select
          value={query.isActive === undefined ? '' : String(query.isActive)}
          onChange={(e) =>
            setQuery((q) => ({ ...q, isActive: e.target.value === '' ? undefined : e.target.value === 'true', page: 1 }))
          }
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
          aria-label="Filter by account status"
        >
          <option value="">Any status</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={load} />}

      {status === 'success' && customers.length === 0 && (
        <EmptyState icon={Users} title="No customers found" description="Try clearing your search or filters." />
      )}

      {status === 'success' && customers.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Total spent</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customers.map((customer) => (
                  <Fragment key={customer._id}>
                    <tr>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{customer.name}</p>
                        <p className="text-xs text-slate">{customer.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={customer.isActive ? 'emerald' : 'coral'}>{customer.isActive ? 'active' : 'inactive'}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-ink-soft">{customer.orderCount}</td>
                      <td className="px-4 py-3 font-mono text-ink-soft">{formatCurrency(customer.totalSpent)}</td>
                      <td className="px-4 py-3 text-ink-soft">{new Date(customer.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === customer._id ? null : customer._id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-slate-100"
                          aria-label="Toggle details"
                        >
                          {expandedId === customer._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === customer._id && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <CustomerDetailPanel customerId={customer._id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
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
