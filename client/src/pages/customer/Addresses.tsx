import { useEffect, useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { addressApi } from '../../features/address/addressApi';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { AddressForm } from '../../components/checkout/AddressForm';
import type { Address, AddressInput } from '../../types/cart';

type Status = 'loading' | 'success' | 'error';

export function Addresses() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'closed' | 'create' | string>('closed'); // string = editing that address id
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    addressApi
      .list()
      .then((data) => {
        setAddresses(data);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setError(anyErr.response?.data?.message ?? 'Failed to load your addresses.');
        setStatus('error');
      });
  };

  useEffect(load, []);

  const handleCreate = async (values: AddressInput) => {
    await addressApi.create(values);
    setFormMode('closed');
    load();
  };

  const handleUpdate = (id: string) => async (values: AddressInput) => {
    await addressApi.update(id, values);
    setFormMode('closed');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this address?')) return;
    setActionError(null);
    try {
      await addressApi.remove(id);
      load();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setActionError(anyErr.response?.data?.message ?? 'Could not delete this address.');
    }
  };

  const handleSetDefault = async (id: string, kind: 'shipping' | 'billing') => {
    setActionError(null);
    try {
      if (kind === 'shipping') await addressApi.setDefaultShipping(id);
      else await addressApi.setDefaultBilling(id);
      load();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setActionError(anyErr.response?.data?.message ?? 'Could not update default address.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Addresses</h1>
          <p className="text-sm text-slate">Manage the addresses used at checkout.</p>
        </div>
        {formMode === 'closed' && (
          <Button size="sm" onClick={() => setFormMode('create')}>
            <Plus size={14} /> Add address
          </Button>
        )}
      </header>

      {actionError && <p className="mb-4 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{actionError}</p>}

      {formMode === 'create' && (
        <Card className="mb-6">
          <CardBody>
            <h2 className="mb-4 font-medium text-ink">New address</h2>
            <AddressForm onSubmit={handleCreate} onCancel={() => setFormMode('closed')} submitLabel="Add address" />
          </CardBody>
        </Card>
      )}

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={load} />}

      {status === 'success' && addresses.length === 0 && formMode !== 'create' && (
        <EmptyState
          icon={MapPin}
          title="No addresses yet"
          description="Add an address to speed up checkout."
          action={
            <Button size="sm" onClick={() => setFormMode('create')}>
              <Plus size={14} /> Add address
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-4">
        {status === 'success' &&
          addresses.map((address) =>
            formMode === address._id ? (
              <Card key={address._id}>
                <CardBody>
                  <h2 className="mb-4 font-medium text-ink">Edit address</h2>
                  <AddressForm initial={address} onSubmit={handleUpdate(address._id)} onCancel={() => setFormMode('closed')} />
                </CardBody>
              </Card>
            ) : (
              <Card key={address._id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold capitalize text-ink">{address.label}</span>
                        {address.isDefaultShipping && <Badge tone="indigo">Default shipping</Badge>}
                        {address.isDefaultBilling && <Badge tone="marigold">Default billing</Badge>}
                      </div>
                      <p className="text-sm text-ink-soft">{address.fullName} · {address.phone}</p>
                      <p className="text-sm text-ink-soft">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postalCode},{' '}
                        {address.country}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFormMode(address._id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-soft hover:bg-slate-100"
                        aria-label="Edit address"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(address._id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-coral-600 hover:bg-coral-100"
                        aria-label="Delete address"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {!address.isDefaultShipping && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(address._id, 'shipping')}
                        className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-ink-soft hover:bg-slate-100"
                      >
                        <Star size={12} /> Set default shipping
                      </button>
                    )}
                    {!address.isDefaultBilling && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(address._id, 'billing')}
                        className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-ink-soft hover:bg-slate-100"
                      >
                        <Star size={12} /> Set default billing
                      </button>
                    )}
                  </div>
                </CardBody>
              </Card>
            )
          )}
      </div>
    </div>
  );
}
