import { useState, Fragment } from 'react';
import { useEffect } from 'react';
import { ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import { orderApi } from '../../features/order/orderApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import type { Order, OrderListQuery, OrderStatus } from '../../types/order';
import { ORDER_STATUS_TRANSITIONS } from '../../types/order';

const ALL_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

function OrderDetailPanel({ order, onAction }: { order: Order; onAction: () => void }) {
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const customer = typeof order.customer === 'string' ? null : order.customer;

  const handleStatusChange = async (groupId: string, status: OrderStatus) => {
    setBusyGroupId(groupId);
    setRowError(null);
    try {
      await orderApi.updateStatus(order._id, status, groupId);
      onAction();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setRowError(anyErr.response?.data?.message ?? 'Could not update status.');
    } finally {
      setBusyGroupId(null);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-slate-100 p-5 text-sm">
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate">Customer</p>
          <p className="text-ink">{customer?.name ?? '—'}</p>
          <p className="text-ink-soft">{customer?.email ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate">Shipping to</p>
          <p className="text-ink-soft">
            {order.shippingAddress.fullName}, {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
            {order.shippingAddress.postalCode}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate">Totals</p>
          <p className="text-ink-soft">
            Subtotal {formatCurrency(order.subtotal)} · Shipping {formatCurrency(order.shippingFee)}
          </p>
          <p className="font-semibold text-ink">Grand total {formatCurrency(order.grandTotal)}</p>
        </div>
      </div>

      {rowError && <p className="mb-3 rounded-md bg-coral-100 px-3 py-2 text-xs text-coral-600">{rowError}</p>}

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">Vendor fulfillment groups</p>
      <div className="space-y-3">
        {order.vendorGroups.map((group) => {
          const allowed = ORDER_STATUS_TRANSITIONS[group.status];
          return (
            <div key={group._id} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-slate">Vendor {group.vendor.slice(-6)}</span>
                <OrderStatusBadge status={group.status} />
              </div>
              <ul className="mb-2 space-y-1">
                {group.items.map((item) => (
                  <li key={item.sku} className="flex justify-between text-xs text-ink-soft">
                    <span>
                      {item.title} × {item.quantity}
                    </span>
                    <span className="font-mono">{formatCurrency(item.lineSubtotal)}</span>
                  </li>
                ))}
              </ul>
              {allowed.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allowed.map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={busyGroupId === group._id}
                      onClick={() => handleStatusChange(group._id, next)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium capitalize text-ink-soft hover:bg-slate-100 disabled:opacity-40"
                    >
                      Mark {next}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminOrders({ scope = 'admin' }: { scope?: 'admin' | 'vendor' } = {}) {
  const [query, setQuery] = useState<OrderListQuery>({ page: 1, limit: 10 });
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    orderApi
      .listManaged(query)
      .then(({ orders: data, meta: m }) => {
        setOrders(data);
        setMeta(m);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setError(anyErr.response?.data?.message ?? 'Failed to load orders.');
        setStatus('error');
      });
  };

  useEffect(load, [query]);

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate">
          {scope === 'admin'
            ? 'Every order across the marketplace, grouped by vendor fulfillment.'
            : 'Orders containing your products. Update fulfillment status as you process each one.'}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <select
          value={query.status ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, status: (e.target.value || undefined) as OrderStatus | undefined, page: 1 }))}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={query.from ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, from: e.target.value || undefined, page: 1 }))}
          className="w-auto"
          aria-label="From date"
        />
        <Input
          type="date"
          value={query.to ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, to: e.target.value || undefined, page: 1 }))}
          className="w-auto"
          aria-label="To date"
        />
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={load} />}

      {status === 'success' && orders.length === 0 && (
        <EmptyState icon={ShoppingCart} title="No orders found" description="Try clearing your filters." />
      )}

      {status === 'success' && orders.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Placed</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Vendors</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((order) => (
                  <Fragment key={order._id}>
                    <tr>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{order.orderNumber}</td>
                      <td className="px-4 py-3 text-ink-soft">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-mono text-ink-soft">{formatCurrency(order.grandTotal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {order.vendorGroups.map((g) => (
                            <OrderStatusBadge key={g._id} status={g.status} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === order._id ? null : order._id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-slate-100"
                          aria-label="Toggle details"
                        >
                          {expandedId === order._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === order._id && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <OrderDetailPanel order={order} onAction={load} />
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
