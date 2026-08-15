import { useState, Fragment } from 'react';
import { Store, ChevronDown, ChevronUp, ShieldCheck, ShieldOff } from 'lucide-react';
import { useVendors } from '../../hooks/useVendors';
import { vendorApi } from '../../features/vendor/vendorApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { VendorStatusBadge } from '../../components/vendor/VendorStatusBadge';
import type { Vendor, VendorListQuery, VendorStatus } from '../../types/vendor';

function ReasonPrompt({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-100 p-3">
      <label className="text-xs font-medium text-ink-soft">{label}</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        placeholder="At least 10 characters…"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1 text-xs font-medium text-ink-soft hover:bg-slate-200">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          disabled={reason.trim().length < 10}
          className="rounded-md bg-coral-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function VendorDetailPanel({ vendor, onAction }: { vendor: Vendor; onAction: () => void }) {
  const [pendingAction, setPendingAction] = useState<'reject' | 'suspend' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const userRef = typeof vendor.user === 'string' ? null : vendor.user;

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      setPendingAction(null);
      onAction();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setActionError(anyErr.response?.data?.message ?? 'Action failed.');
    }
  };

  return (
    <div className="grid gap-6 border-t border-slate-200 bg-slate-100 p-5 md:grid-cols-2">
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate">Account</p>
          <p className="text-ink">{userRef?.name ?? '—'}</p>
          <p className="text-ink-soft">{userRef?.email ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate">Business contact</p>
          <p className="text-ink-soft">{vendor.businessEmail}</p>
          <p className="text-ink-soft">{vendor.businessPhone}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate">Address</p>
          <p className="text-ink-soft">
            {vendor.address.line1}
            {vendor.address.line2 ? `, ${vendor.address.line2}` : ''}, {vendor.address.city}, {vendor.address.state}{' '}
            {vendor.address.postalCode}, {vendor.address.country}
          </p>
        </div>
        {vendor.legalBusinessName && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate">Legal name</p>
            <p className="text-ink-soft">{vendor.legalBusinessName}</p>
          </div>
        )}
        {vendor.taxId && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate">Tax ID</p>
            <p className="font-mono text-ink-soft">{vendor.taxId}</p>
          </div>
        )}
        {vendor.rejectionReason && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate">Rejection reason</p>
            <p className="text-coral-600">{vendor.rejectionReason}</p>
          </div>
        )}
        {vendor.suspensionReason && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate">Suspension reason</p>
            <p className="text-coral-600">{vendor.suspensionReason}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate">Actions</p>
        {actionError && <p className="rounded-md bg-coral-100 px-2 py-1.5 text-xs text-coral-600">{actionError}</p>}

        {pendingAction === 'reject' && (
          <ReasonPrompt
            label="Rejection reason"
            onCancel={() => setPendingAction(null)}
            onConfirm={(reason) => run(() => vendorApi.reject(vendor._id, reason))}
          />
        )}
        {pendingAction === 'suspend' && (
          <ReasonPrompt
            label="Suspension reason"
            onCancel={() => setPendingAction(null)}
            onConfirm={(reason) => run(() => vendorApi.suspend(vendor._id, reason))}
          />
        )}

        {!pendingAction && (
          <div className="flex flex-wrap gap-2">
            {vendor.status === 'pending' && (
              <>
                <Button size="sm" onClick={() => run(() => vendorApi.approve(vendor._id))}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" onClick={() => setPendingAction('reject')}>
                  Reject
                </Button>
              </>
            )}
            {vendor.status === 'approved' && (
              <Button size="sm" variant="danger" onClick={() => setPendingAction('suspend')}>
                Suspend
              </Button>
            )}
            {vendor.status === 'suspended' && (
              <Button size="sm" onClick={() => run(() => vendorApi.reactivate(vendor._id))}>
                Reactivate
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => run(() => vendorApi.setVerification(vendor._id, !vendor.isVerified))}
            >
              {vendor.isVerified ? (
                <>
                  <ShieldOff size={14} /> Unverify
                </>
              ) : (
                <>
                  <ShieldCheck size={14} /> Mark verified
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminVendors() {
  const [query, setQuery] = useState<VendorListQuery>({ page: 1, limit: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { vendors, meta, status, error, refetch } = useVendors(query);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((q) => ({ ...q, q: searchInput || undefined, page: 1 }));
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <p className="text-sm text-slate">Review applications and manage seller accounts.</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={submitSearch} className="flex max-w-sm flex-1 gap-2">
          <Input
            placeholder="Search store name, email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search vendors"
          />
          <button type="submit" className="rounded-md border border-slate-200 px-3 text-sm text-ink-soft hover:bg-slate-100">
            Search
          </button>
        </form>

        <div className="flex gap-2">
          <select
            value={query.status ?? ''}
            onChange={(e) => setQuery((q) => ({ ...q, status: (e.target.value || undefined) as VendorStatus | undefined, page: 1 }))}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            value={query.isVerified === undefined ? '' : String(query.isVerified)}
            onChange={(e) =>
              setQuery((q) => ({ ...q, isVerified: e.target.value === '' ? undefined : e.target.value === 'true', page: 1 }))
            }
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
            aria-label="Filter by verification"
          >
            <option value="">Any verification</option>
            <option value="true">Verified only</option>
            <option value="false">Unverified only</option>
          </select>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

      {status === 'success' && vendors.length === 0 && (
        <EmptyState icon={Store} title="No vendors found" description="Try clearing your search or filters." />
      )}

      {status === 'success' && vendors.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {vendors.map((vendor) => (
                  <Fragment key={vendor._id}>
                    <tr>
                      <td className="px-4 py-3 font-medium text-ink">{vendor.storeName}</td>
                      <td className="px-4 py-3">
                        <VendorStatusBadge status={vendor.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={vendor.isVerified ? 'indigo' : 'neutral'}>{vendor.isVerified ? 'yes' : 'no'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{new Date(vendor.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === vendor._id ? null : vendor._id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-slate-100"
                          aria-label="Toggle details"
                        >
                          {expandedId === vendor._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === vendor._id && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <VendorDetailPanel vendor={vendor} onAction={refetch} />
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
