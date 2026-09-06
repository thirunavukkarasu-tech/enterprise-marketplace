import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Boxes, FileEdit, Archive, AlertCircle, Info, Store, ShoppingCart, Clock, PackageCheck, DollarSign, AlertTriangle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { KpiCard } from '../../components/common/KpiCard';
import { formatCurrency } from '../../utils/formatCurrency';
import { TrendChart } from '../../components/common/TrendChart';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { VendorStatusBadge } from '../../components/vendor/VendorStatusBadge';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { vendorApi } from '../../features/vendor/vendorApi';
import type { VendorDashboard } from '../../types/vendor';
import type { OrderStatus } from '../../types/order';

type Status = 'loading' | 'success' | 'error' | 'no-profile';

export function VendorOverview() {
  const [dashboard, setDashboard] = useState<VendorDashboard | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    vendorApi
      .getOwnDashboard()
      .then((data) => {
        setDashboard(data);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
        if (anyErr.response?.status === 404) {
          setStatus('no-profile');
        } else {
          setError(anyErr.response?.data?.message ?? 'Failed to load your dashboard.');
          setStatus('error');
        }
      });
  };

  useEffect(load, []);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (status === 'no-profile') {
    return (
      <div className="p-8">
        <EmptyState
          icon={Store}
          title="Set up your store"
          description="Submit your business details to start selling on MarketSphere. An admin will review your application."
          action={
            <Link to="/vendor/settings">
              <Button size="sm">Create store profile</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (status === 'error' || !dashboard) {
    return (
      <div className="p-8">
        <ErrorState message={error ?? 'Something went wrong.'} onRetry={load} />
      </div>
    );
  }

  const { vendor, productCounts, profileCompletion, recentProducts, notices, orderStats, revenue, recentOrders, salesTrend, inventoryAlerts } = dashboard;

  const productKpis = [
    { label: 'Total products', value: productCounts.total, icon: Boxes, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Active listings', value: productCounts.active, icon: Package, tone: 'text-emerald-600 bg-emerald-100' },
    { label: 'Drafts', value: productCounts.draft, icon: FileEdit, tone: 'text-marigold-600 bg-marigold-100' },
    { label: 'Archived', value: productCounts.archived, icon: Archive, tone: 'text-ink-soft bg-slate-100' },
  ];

  const orderKpis = [
    { label: 'Revenue', value: formatCurrency(revenue), icon: DollarSign, tone: 'text-marigold-600 bg-marigold-100' },
    { label: 'Total orders', value: orderStats.total, icon: ShoppingCart, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Pending orders', value: orderStats.pending, icon: Clock, tone: 'text-marigold-600 bg-marigold-100' },
    { label: 'Completed orders', value: orderStats.completed, icon: PackageCheck, tone: 'text-emerald-600 bg-emerald-100' },
  ];

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{vendor.storeName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <VendorStatusBadge status={vendor.status} />
            {vendor.isVerified && <Badge tone="indigo">verified</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/vendor/inventory">
            <Button variant="secondary" size="sm">
              Inventory
            </Button>
          </Link>
          <Link to="/vendor/settings">
            <Button variant="secondary" size="sm">
              Edit store profile
            </Button>
          </Link>
        </div>
      </header>

      {notices.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {notices.map((notice, i) => (
            <div
              key={i}
              className={
                notice.tone === 'error'
                  ? 'flex items-start gap-2 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600'
                  : 'flex items-start gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-700'
              }
            >
              {notice.tone === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
              <span>{notice.message}</span>
            </div>
          ))}
        </div>
      )}

      {(inventoryAlerts.lowStock > 0 || inventoryAlerts.outOfStock > 0) && (
        <Link to="/vendor/inventory" className="mb-6 flex items-center gap-2 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600 hover:bg-coral-100/80">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            {inventoryAlerts.outOfStock > 0 && `${inventoryAlerts.outOfStock} SKU${inventoryAlerts.outOfStock === 1 ? '' : 's'} out of stock`}
            {inventoryAlerts.outOfStock > 0 && inventoryAlerts.lowStock > 0 && ' · '}
            {inventoryAlerts.lowStock > 0 && `${inventoryAlerts.lowStock} running low`}
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {orderKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {productKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Sales trend (last 14 days)</h2>
          </CardHeader>
          <CardBody>
            <TrendChart data={salesTrend} metric="revenue" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-medium">Recent orders</h2>
          </CardHeader>
          <CardBody>
            {recentOrders.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No orders yet" description="Orders placed by customers will show up here." />
            ) : (
              <ul className="divide-y divide-slate-200">
                {recentOrders.map((o) => (
                  <li key={o.orderId} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-mono text-xs text-ink">{o.orderNumber}</p>
                      <p className="text-xs text-slate">{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-ink-soft">{formatCurrency(o.subtotal)}</span>
                      <OrderStatusBadge status={o.status as OrderStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Recent products</h2>
          </CardHeader>
          <CardBody>
            {recentProducts.length === 0 ? (
              <EmptyState icon={Package} title="No products yet" description="Products you add will show up here." />
            ) : (
              <ul className="divide-y divide-slate-200">
                {recentProducts.map((p) => (
                  <li key={p._id} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-medium text-ink">{p.title}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-ink-soft">{formatCurrency(p.priceRange.min)}</span>
                      <Badge tone={p.status === 'active' ? 'emerald' : p.status === 'archived' ? 'coral' : 'neutral'}>
                        {p.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-medium">Profile completion</h2>
          </CardHeader>
          <CardBody>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${profileCompletion}%` }} />
            </div>
            <p className="text-sm text-slate">{profileCompletion}% complete</p>
            {profileCompletion < 100 && (
              <Link to="/vendor/settings" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
                Complete your profile →
              </Link>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
