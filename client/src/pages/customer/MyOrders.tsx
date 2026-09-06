import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, ChevronRight } from 'lucide-react';
import { orderApi } from '../../features/order/orderApi';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import type { Order, PaginationMeta } from '../../types/order';

const EMPTY_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 1 };

/** An order can span several vendors, each with its own fulfillment
 * status (see Order.model.js) — the list shows the "furthest along"
 * status isn't well-defined, so it shows each vendor group's status as
 * its own small badge rather than inventing a single misleading summary. */
function OrderRow({ order }: { order: Order }) {
  return (
    <Link to={`/orders/${order._id}`}>
      <Card className="transition-shadow hover:shadow-panel-lg">
        <CardBody className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-sm font-medium text-ink">{order.orderNumber}</p>
            <p className="text-xs text-slate">{new Date(order.createdAt).toLocaleDateString()}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {order.vendorGroups.map((g) => (
                <OrderStatusBadge key={g._id} status={g.status} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-ink">{formatCurrency(order.grandTotal)}</span>
            <ChevronRight size={16} className="text-slate" />
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export function MyOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    orderApi
      .listOwn({ page, limit: 10 })
      .then((res) => {
        setOrders(res.orders);
        setMeta(res.meta);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setError(anyErr.response?.data?.message ?? 'Failed to load your orders.');
        setStatus('error');
      });
  };

  useEffect(load, [page]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Your orders</h1>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={load} />}

      {status === 'success' && orders.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title="No orders yet"
          description="Orders you place will show up here."
          action={
            <Link to="/products">
              <span className="text-sm font-medium text-indigo-600 hover:underline">Start shopping</span>
            </Link>
          }
        />
      )}

      {status === 'success' && orders.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <OrderRow key={order._id} order={order} />
            ))}
          </div>
          <div className="mt-8">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
