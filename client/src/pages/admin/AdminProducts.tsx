import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import { fetchManagedProducts, managedListInvalidated } from '../../features/catalog/productSlice';
import { productApi } from '../../features/catalog/productApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/catalog/StatusBadge';
import type { ProductStatus } from '../../types/catalog';

export function AdminProducts() {
  const dispatch = useAppDispatch();
  const { items, meta, status, error } = useAppSelector((state) => state.products.managed);
  const [searchParams, setSearchParams] = useSearchParams();
  const [busyId, setBusyId] = useState<string | null>(null);

  const statusFilter = (searchParams.get('status') as ProductStatus) ?? undefined;
  const page = Number(searchParams.get('page') ?? '1');

  const load = () => dispatch(fetchManagedProducts({ status: statusFilter, page, limit: 20 }));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, statusFilter, page]);

  const changeStatus = async (id: string, newStatus: ProductStatus) => {
    setBusyId(id);
    try {
      await productApi.update(id, { status: newStatus });
      dispatch(managedListInvalidated());
      load();
    } catch {
      alert('Failed to update product status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this product from the marketplace? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await productApi.remove(id);
      dispatch(managedListInvalidated());
      load();
    } catch {
      alert('Failed to delete product.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Product moderation</h1>
        <p className="text-sm text-slate">Every vendor's listings — publish, archive, or remove as needed.</p>
      </header>

      <div className="mb-4 flex gap-2">
        {(['', 'draft', 'active', 'archived'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setSearchParams(s ? { status: s } : {})}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              statusFilter === s || (!statusFilter && !s)
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-100 text-ink-soft hover:bg-slate-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'failed' && <ErrorState message={error ?? 'Failed to load products.'} onRetry={load} />}

      {status === 'succeeded' && items.length === 0 && (
        <EmptyState title="No products match this filter" />
      )}

      {status === 'succeeded' && items.length > 0 && (
        <>
          <Card>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((product) => (
                  <tr key={product._id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{product.title}</td>
                    <td className="px-4 py-3 text-ink-soft">{product.vendor.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{product.category.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {product.status !== 'active' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === product._id}
                            onClick={() => changeStatus(product._id, 'active')}
                          >
                            Publish
                          </Button>
                        )}
                        {product.status !== 'archived' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === product._id}
                            onClick={() => changeStatus(product._id, 'archived')}
                          >
                            Archive
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === product._id}
                          onClick={() => handleDelete(product._id)}
                        >
                          <Trash2 size={14} className="text-coral-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {meta && (
            <div className="mt-4">
              <Pagination
                meta={meta}
                onPageChange={(p) => setSearchParams({ ...(statusFilter ? { status: statusFilter } : {}), page: String(p) })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
