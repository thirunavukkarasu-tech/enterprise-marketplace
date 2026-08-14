import { useState } from 'react';
import { Search, PackageSearch } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { ProductCard } from '../../components/product/ProductCard';
import { Pagination } from '../../components/ui/Pagination';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Input } from '../../components/ui/Input';
import type { ProductListQuery, ProductSort } from '../../types/catalog';

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

export function ProductListing() {
  const [query, setQuery] = useState<ProductListQuery>({ page: 1, limit: 12 });
  const [searchInput, setSearchInput] = useState('');

  const { categories } = useCategories();
  const { products, meta, status, error, refetch } = useProducts(query);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((q) => ({ ...q, q: searchInput || undefined, page: 1 }));
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Shop</h1>
        <p className="text-sm text-slate">Browse listings from every vendor on MarketSphere.</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={submitSearch} className="flex max-w-sm flex-1 gap-2">
          <Input
            placeholder="Search products…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search products"
          />
          <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-500 text-white">
            <Search size={16} />
          </button>
        </form>

        <div className="flex gap-2">
          <select
            value={query.category ?? ''}
            onChange={(e) => setQuery((q) => ({ ...q, category: e.target.value || undefined, page: 1 }))}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={query.sort ?? 'newest'}
            onChange={(e) => setQuery((q) => ({ ...q, sort: e.target.value as ProductSort, page: 1 }))}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
            aria-label="Sort products"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

      {status === 'success' && products.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title="No products found"
          description="Try a different search term or clear your filters."
        />
      )}

      {status === 'success' && products.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
          <div className="mt-8">
            <Pagination meta={meta} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
          </div>
        </>
      )}
    </div>
  );
}
