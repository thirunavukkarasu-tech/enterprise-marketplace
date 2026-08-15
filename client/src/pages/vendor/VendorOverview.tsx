import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Boxes, FileEdit, Archive, AlertCircle, Info, Store } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { VendorStatusBadge } from '../../components/vendor/VendorStatusBadge';
import { vendorApi } from '../../features/vendor/vendorApi';
import type { VendorDashboard } from '../../types/vendor';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

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

  const { vendor, productCounts, profileCompletion, recentProducts, notices } = dashboard;

  const kpis = [
    { label: 'Total products', value: productCounts.total, icon: Boxes, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Active listings', value: productCounts.active, icon: Package, tone: 'text-emerald-600 bg-emerald-100' },
    { label: 'Drafts', value: productCounts.draft, icon: FileEdit, tone: 'text-marigold-600 bg-marigold-100' },
    { label: 'Archived', value: productCounts.archived, icon: Archive, tone: 'text-ink-soft bg-slate-100' },
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
        <Link to="/vendor/settings">
          <Button variant="secondary" size="sm">
            Edit store profile
          </Button>
        </Link>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardBody className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate">{kpi.label}</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-ink">{kpi.value}</p>
                </div>
                <span className={`rounded-md p-2 ${kpi.tone}`}>
                  <Icon size={18} />
                </span>
              </CardBody>
            </Card>
          );
        })}
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
                      <span className="font-mono text-ink-soft">{formatPrice(p.priceRange.min)}</span>
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
