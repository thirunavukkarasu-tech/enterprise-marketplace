import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { orderApi } from '../../features/order/orderApi';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import type { Order } from '../../types/order';

export function MyOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'not-found'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    orderApi
      .getOwn(id)
      .then((o) => {
        setOrder(o);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
        if (anyErr.response?.status === 404) {
          setStatus('not-found');
        } else {
          setError(anyErr.response?.data?.message ?? 'Failed to load this order.');
          setStatus('error');
        }
      });
  }, [id]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-lg font-semibold text-ink">Order not found</h1>
        <p className="mt-1 text-sm text-slate">It may not belong to your account, or the link is incorrect.</p>
        <Link to="/orders" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to your orders
        </Link>
      </div>
    );
  }

  if (status === 'error' || !order) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <ErrorState message={error ?? 'Something went wrong.'} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link to="/orders" className="mb-6 inline-flex items-center gap-1 text-sm text-slate hover:text-ink">
        <ChevronLeft size={16} /> Back to your orders
      </Link>

      <header className="mb-6">
        <h1 className="font-mono text-xl font-semibold text-ink">{order.orderNumber}</h1>
        <p className="text-sm text-slate">Placed {new Date(order.createdAt).toLocaleString()}</p>
      </header>

      {order.vendorGroups.map((group, idx) => (
        <Card key={group._id} className="mb-4">
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-medium text-ink">Shipment {order.vendorGroups.length > 1 ? `#${idx + 1}` : ''}</h2>
            <OrderStatusBadge status={group.status} />
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-200">
              {group.items.map((item) => (
                <li key={item.sku} className="flex justify-between py-2 text-sm">
                  <div>
                    <p className="text-ink">{item.title}</p>
                    <p className="font-mono text-xs text-slate">
                      {item.sku} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-mono text-ink-soft">{formatCurrency(item.lineSubtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-medium">
              <span className="text-ink-soft">Shipment subtotal</span>
              <span className="font-mono text-ink">{formatCurrency(group.subtotal)}</span>
            </div>
          </CardBody>
        </Card>
      ))}

      <Card className="mb-4">
        <CardHeader>
          <h2 className="font-medium text-ink">Shipping to</h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-ink-soft">
            {order.shippingAddress.fullName}, {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-ink">Order summary</h2>
        </CardHeader>
        <CardBody className="space-y-1 text-sm">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>Shipping ({order.shippingMethod})</span>
            <span className="font-mono">{order.shippingFee > 0 ? formatCurrency(order.shippingFee) : 'Free'}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>Tax</span>
            <span className="font-mono">{formatCurrency(order.taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-ink">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(order.grandTotal)}</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
