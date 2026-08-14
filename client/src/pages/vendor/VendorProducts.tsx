import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package, Pencil, Trash2 } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { productApi } from '../../features/catalog/productApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import type { ProductListQuery, ProductStatus } from '../../types/catalog';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function VendorProducts() {
  const [query, setQuery] = useState<ProductListQuery>({ page: 1, limit: 10 });
  const { products, meta, status, error, refetch } = useProducts(query, { managed: true });
  const [actionError, setActionError] = useState<string | null>(null);

  const handleStatusChange = async (id: string, next: ProductStatus) => {
    setActionError(null);
    try {
      await productApi.updateStatus(id, next);
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setActionError(anyErr.response?.data?.message ?? 'Could not update status.');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await productApi.remove(id);
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setActionError(anyErr.response?.data?.message ?? 'Could not delete this product.');
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-slate">Manage the products you sell on MarketSphere.</p>
        </div>
        <Link to="/vendor/products/new">
          <Button>
            <Plus size={16} /> New product
          </Button>
        </Link>
      </header>

      {actionError && <p className="mb-4 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{actionError}</p>}

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

      {status === 'success' && products.length === 0 && (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Create your first product to start selling."
          action={
            <Link to="/vendor/products/new">
              <Button size="sm">
                <Plus size={14} /> New product
              </Button>
            </Link>
          }
        />
      )}

      {status === 'success' && products.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((product) => {
                  const totalStock = product.variants.reduce((sum, v) => sum + v.availableStock, 0);
                  return (
                    <tr key={product._id}>
                      <td className="px-4 py-3 font-medium text-ink">{product.title}</td>
                      <td className="px-4 py-3 font-mono text-ink-soft">
                        {product.priceRange.min === product.priceRange.max
                          ? formatPrice(product.priceRange.min)
                          : `${formatPrice(product.priceRange.min)}–${formatPrice(product.priceRange.max)}`}
                      </td>
                      <td className="px-4 py-3 font-mono text-ink-soft">{totalStock}</td>
                      <td className="px-4 py-3">
                        <select
                          value={product.status}
                          onChange={(e) => handleStatusChange(product._id, e.target.value as ProductStatus)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          <option value="draft">draft</option>
                          <option value="active">active</option>
                          <option value="archived">archived</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            to={`/vendor/products/${product._id}/edit`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-soft hover:bg-slate-100"
                            aria-label="Edit product"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(product._id, product.title)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-coral-600 hover:bg-coral-100"
                            aria-label="Delete product"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
