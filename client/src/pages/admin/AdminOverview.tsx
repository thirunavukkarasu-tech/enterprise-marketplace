import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Store,
  ShoppingCart,
  DollarSign,
  Boxes,
  PackageCheck,
  AlertTriangle,
  Clock,
  XCircle,
} from 'lucide-react';
import { adminApi } from '../../features/admin/adminApi';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { KpiCard } from '../../components/common/KpiCard';
import { formatCurrency } from '../../utils/formatCurrency';
import { TrendChart } from '../../components/common/TrendChart';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import type { AdminDashboardOverview } from '../../types/operations';

function formatActionLabel(action: string) {
  return action.replace(/[._]/g, ' ');
}

export function AdminOverview() {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    adminApi
      .getDashboardOverview()
      .then((data) => {
        setOverview(data);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setError(anyErr.response?.data?.message ?? 'Failed to load the dashboard.');
        setStatus('error');
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

  if (status === 'error' || !overview) {
    return (
      <div className="p-8">
        <ErrorState message={error ?? 'Something went wrong.'} onRetry={load} />
      </div>
    );
  }

  const kpis = [
    { label: 'Total revenue', value: formatCurrency(overview.totalRevenue), icon: DollarSign, tone: 'text-marigold-600 bg-marigold-100' },
    { label: 'Total users', value: overview.totalUsers, icon: Users, tone: 'text-ink-soft bg-slate-100' },
    { label: 'Vendor accounts', value: overview.totalVendorAccounts, icon: Store, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Customers', value: overview.totalCustomers, icon: Users, tone: 'text-ink-soft bg-slate-100' },
    { label: 'Total products', value: overview.totalProducts, icon: Boxes, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Active products', value: overview.activeProducts, icon: PackageCheck, tone: 'text-emerald-600 bg-emerald-100' },
    { label: 'Low-stock products', value: overview.lowStockProductCount, icon: AlertTriangle, tone: 'text-coral-600 bg-coral-100' },
    { label: 'Pending vendor approvals', value: overview.pendingVendorApprovals, icon: Clock, tone: 'text-marigold-600 bg-marigold-100' },
  ];

  const orderKpis = [
    { label: 'Pending orders', value: overview.pendingOrderGroups, icon: Clock, tone: 'text-marigold-600 bg-marigold-100' },
    { label: 'Completed orders', value: overview.completedOrderGroups, icon: PackageCheck, tone: 'text-emerald-600 bg-emerald-100' },
    { label: 'Cancelled/refunded', value: overview.cancelledOrderGroups, icon: XCircle, tone: 'text-coral-600 bg-coral-100' },
  ];

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-slate">Real-time marketplace metrics.</p>
        </div>
        {overview.pendingVendorApprovals > 0 && (
          <Link
            to="/admin/vendors"
            className="rounded-md bg-marigold-100 px-3 py-1.5 text-sm font-medium text-marigold-600 hover:bg-marigold-100/80"
          >
            {overview.pendingVendorApprovals} vendor{overview.pendingVendorApprovals === 1 ? '' : 's'} awaiting review
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {orderKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Revenue trend (last 14 days)</h2>
          </CardHeader>
          <CardBody>
            <TrendChart data={overview.revenueTrend} metric="revenue" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-medium">Order trend (last 14 days)</h2>
          </CardHeader>
          <CardBody>
            <TrendChart data={overview.revenueTrend} metric="orders" />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Top vendors by revenue</h2>
          </CardHeader>
          <CardBody>
            {overview.vendorPerformance.length === 0 ? (
              <p className="text-sm text-slate">No vendor sales yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {overview.vendorPerformance.map((v) => (
                  <li key={v.vendorUserId} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium text-ink">{v.storeName}</span>
                    <span className="flex items-center gap-3 text-ink-soft">
                      <span className="flex items-center gap-1 font-mono text-xs">
                        <ShoppingCart size={12} /> {v.orderCount}
                      </span>
                      <span className="font-mono font-semibold text-ink">{formatCurrency(v.revenue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-medium">Recent platform activity</h2>
          </CardHeader>
          <CardBody>
            {overview.recentActivity.length === 0 ? (
              <p className="text-sm text-slate">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {overview.recentActivity.map((entry) => {
                  const actorName = typeof entry.actor === 'string' ? 'Unknown' : entry.actor.name;
                  return (
                    <li key={entry._id} className="py-2.5 text-sm">
                      <p className="text-ink-soft">
                        <span className="font-medium text-ink">{actorName}</span>{' '}
                        <span className="capitalize">{formatActionLabel(entry.action)}</span>
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
