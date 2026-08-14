import { useState } from 'react';
import { Package } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { productApi } from '../../features/catalog/productApi';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { ProductStatusBadge } from '../../components/product/ProductStatusBadge';
import { Input } from '../../components/ui/Input';
import type { ProductListQuery, ProductStatus } from '../../types/catalog';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function AdminProducts() {
  const [query, setQuery] = useState<ProductListQuery>({ page: 1, limit: 10 });
  const [vendorFilter, setVendorFilter] = useState('');
  const { products, meta, status, error, refetch } = useProducts(query, { managed: true });
  const [actionError, setActionError] = useState<string | null>(null);

  const applyVendorFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((q) => ({ ...q, vendor: vendorFilter || undefined, page: 1 }));
  };

  const handleModerate = async (id: string, next: ProductStatus) => {
    setActionError(null);
    try {
      await productApi.updateStatus(id, next);
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setActionError(anyErr.response?.data?.message ?? 'Could not update status.');
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Product moderation</h1>
        <p className="text-sm text-slate">Every vendor's products, across the whole marketplace.</p>
      </header>

      <form onSubmit={applyVendorFilter} className="mb-6 flex max-w-sm gap-2">
        <Input
          placeholder="Filter by vendor id…"
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          aria-label="Filter by vendor id"
        />
        <button type="submit" className="rounded-md border border-slate-200 px-3 text-sm text-ink-soft hover:bg-slate-100">
          Filter
        </button>
      </form>

      {actionError && <p className="mb-4 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{actionError}</p>}

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

      {status === 'success' && products.length === 0 && (
        <EmptyState icon={Package} title="No products found" description="Try clearing the vendor filter." />
      )}

      {status === 'success' && products.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Moderate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((product) => (
                  <tr key={product._id}>
                    <td className="px-4 py-3 font-medium text-ink">{product.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate">{product.vendor}</td>
                    <td className="px-4 py-3 font-mono text-ink-soft">
                      {product.priceRange.min === product.priceRange.max
                        ? formatPrice(product.priceRange.min)
                        : `${formatPrice(product.priceRange.min)}–${formatPrice(product.priceRange.max)}`}
                    </td>
                    <td className="px-4 py-3">
                      <ProductStatusBadge status={product.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {product.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleModerate(product._id, 'archived')}
                            className="rounded-md border border-coral-100 px-2 py-1 text-xs font-medium text-coral-600 hover:bg-coral-100"
                          >
                            Archive
                          </button>
                        )}
                        {product.status === 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleModerate(product._id, 'active')}
                            className="rounded-md border border-emerald-100 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-100"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
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
