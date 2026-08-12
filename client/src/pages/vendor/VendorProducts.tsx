import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import { fetchManagedProducts, managedListInvalidated } from '../../features/catalog/productSlice';
import { productApi } from '../../features/catalog/productApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/catalog/StatusBadge';
import type { ProductStatus } from '../../types/catalog';

export function VendorProducts() {
  const dispatch = useAppDispatch();
  const { items, meta, status, error } = useAppSelector((state) => state.products.managed);
  const [searchParams, setSearchParams] = useSearchParams();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const statusFilter = (searchParams.get('status') as ProductStatus) ?? undefined;
  const page = Number(searchParams.get('page') ?? '1');

  useEffect(() => {
    dispatch(fetchManagedProducts({ status: statusFilter, page, limit: 20 }));
  }, [dispatch, statusFilter, page]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await productApi.remove(id);
      dispatch(managedListInvalidated());
      dispatch(fetchManagedProducts({ status: statusFilter, page, limit: 20 }));
    } catch {
      alert('Failed to delete product. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My products</h1>
          <p className="text-sm text-slate">Manage your own listings — other vendors' products aren't shown here.</p>
        </div>
        <Link to="/vendor/products/new">
          <Button>
            <Plus size={16} /> New product
          </Button>
        </Link>
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

      {status === 'failed' && (
        <ErrorState
          message={error ?? 'Failed to load your products.'}
          onRetry={() => dispatch(fetchManagedProducts({ status: statusFilter, page, limit: 20 }))}
        />
      )}

      {status === 'succeeded' && items.length === 0 && (
        <EmptyState
          title="No products yet"
          description="Create your first listing to start selling on MarketSphere."
          action={
            <Link to="/vendor/products/new">
              <Button size="sm">
                <Plus size={15} /> New product
              </Button>
            </Link>
          }
        />
      )}

      {status === 'succeeded' && items.length > 0 && (
        <>
          <Card>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((product) => (
                  <tr key={product._id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{product.title}</td>
                    <td className="px-4 py-3 text-ink-soft">{product.category.name}</td>
                    <td className="px-4 py-3 font-mono text-ink-soft">
                      ${product.priceRange.min.toFixed(2)}
                      {product.priceRange.max !== product.priceRange.min && ` – $${product.priceRange.max.toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link to={`/vendor/products/${product._id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Pencil size={14} />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === product._id}
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
              <Pagination meta={meta} onPageChange={(p) => setSearchParams({ ...(statusFilter ? { status: statusFilter } : {}), page: String(p) })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
