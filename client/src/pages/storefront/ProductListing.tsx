import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import { fetchPublicProducts } from '../../features/catalog/productSlice';
import { fetchCategories } from '../../features/catalog/categorySlice';
import { ProductCard } from '../../components/catalog/ProductCard';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { Input } from '../../components/ui/Input';
import type { ProductSort } from '../../types/catalog';

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'title_asc', label: 'Name: A–Z' },
];

export function ProductListing() {
  const dispatch = useAppDispatch();
  const { items, meta, status, error } = useAppSelector((state) => state.products.public);
  const categories = useAppSelector((state) => state.categories.items);
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const sort = (searchParams.get('sort') as ProductSort) ?? 'newest';
  const page = Number(searchParams.get('page') ?? '1');

  const [qInput, setQInput] = useState(q);

  useEffect(() => {
    dispatch(fetchCategories({}));
  }, [dispatch]);

  useEffect(() => {
    dispatch(
      fetchPublicProducts({
        q: q || undefined,
        category: category || undefined,
        sort,
        page,
        limit: 20,
      })
    );
  }, [dispatch, q, category, sort, page]);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!('page' in updates)) next.delete('page'); // reset pagination on any filter change
    setSearchParams(next);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Shop all products</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ q: qInput });
        }}
        className="mb-6 flex flex-wrap items-center gap-3"
      >
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate" size={16} />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>

        <select
          value={category}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </form>

      {status === 'loading' && (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      )}

      {status === 'failed' && (
        <ErrorState
          message={error ?? 'Failed to load products.'}
          onRetry={() => dispatch(fetchPublicProducts({ q, category, sort, page, limit: 20 }))}
        />
      )}

      {status === 'succeeded' && items.length === 0 && (
        <EmptyState
          title="No products found"
          description="Try a different search term, category, or clear your filters."
        />
      )}

      {status === 'succeeded' && items.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
          {meta && (
            <div className="mt-6">
              <Pagination meta={meta} onPageChange={(p) => updateParams({ page: String(p) })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
