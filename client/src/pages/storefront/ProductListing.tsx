import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import type { ProductListQuery, ProductSort } from '../../types/catalog';

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

const SEARCH_DEBOUNCE_MS = 400;

/** Query state lives in the URL (via useSearchParams), not component
 * state — a shared listing/category/search link is shareable and
 * survives back/forward navigation, and it's how CategoryBrowse and
 * StorefrontHome link into this page with a pre-set category filter. */
function useListingQuery() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query: ProductListQuery = useMemo(() => {
    const get = (key: string) => searchParams.get(key) ?? undefined;
    return {
      q: get('q'),
      category: get('category'),
      minPrice: get('minPrice') ? Number(get('minPrice')) : undefined,
      maxPrice: get('maxPrice') ? Number(get('maxPrice')) : undefined,
      inStock: get('inStock') === 'true' ? true : undefined,
      sort: (get('sort') as ProductSort) ?? undefined,
      page: get('page') ? Number(get('page')) : 1,
      limit: 12,
    };
  }, [searchParams]);

  const patch = (next: Partial<ProductListQuery>, { resetPage = true } = {}) => {
    const merged: ProductListQuery = { ...query, ...next, ...(resetPage ? { page: 1 } : {}) };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && key !== 'limit') params.set(key, String(value));
    });
    setSearchParams(params);
  };

  return { query, patch };
}

export function ProductListing() {
  const { query, patch } = useListingQuery();
  const [searchInput, setSearchInput] = useState(query.q ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const [priceInputs, setPriceInputs] = useState({
    min: query.minPrice?.toString() ?? '',
    max: query.maxPrice?.toString() ?? '',
  });

  const { categories } = useCategories();
  const { products, meta, status, error, refetch } = useProducts(query);

  // Debounced live search — typing pauses for 400ms before a request
  // fires, so every keystroke doesn't trigger a fresh API call. Pressing
  // Enter (the form's onSubmit) still applies immediately.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== (query.q ?? '')) patch({ q: searchInput || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    patch({ q: searchInput || undefined });
  };

  const applyPriceRange = (e: React.FormEvent) => {
    e.preventDefault();
    patch({
      minPrice: priceInputs.min ? Number(priceInputs.min) : undefined,
      maxPrice: priceInputs.max ? Number(priceInputs.max) : undefined,
    });
  };

  const activeFilterCount = [query.category, query.minPrice, query.maxPrice, query.inStock].filter(
    (v) => v !== undefined
  ).length;

  const clearFilters = () => {
    setPriceInputs({ min: '', max: '' });
    patch({ category: undefined, minPrice: undefined, maxPrice: undefined, inStock: undefined });
  };

  const selectedCategoryName = categories.find((c) => c._id === query.category)?.name;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{selectedCategoryName ?? 'Shop'}</h1>
        <p className="text-sm text-slate">Browse listings from every vendor on MarketSphere.</p>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={submitSearch} className="flex max-w-sm flex-1 gap-2">
          <Input
            placeholder="Search products…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search products"
          />
          <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-white">
            <Search size={16} />
          </button>
        </form>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink-soft hover:bg-slate-100 sm:hidden"
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeFilterCount > 0 && <span className="rounded-full bg-indigo-500 px-1.5 text-xs text-white">{activeFilterCount}</span>}
          </button>

          <select
            value={query.sort ?? 'newest'}
            onChange={(e) => patch({ sort: e.target.value as ProductSort })}
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

      {/* Filter panel — always visible on sm+, toggled on mobile */}
      <div className={`mb-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-canvas-raised p-4 sm:flex-row sm:items-end sm:gap-6 ${showFilters ? 'flex' : 'hidden sm:flex'}`}>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-soft" htmlFor="category-filter">
            Category
          </label>
          <select
            id="category-filter"
            value={query.category ?? ''}
            onChange={(e) => patch({ category: e.target.value || undefined })}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-ink-soft"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={applyPriceRange} className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-soft" htmlFor="min-price">
              Min price
            </label>
            <Input
              id="min-price"
              type="number"
              min={0}
              className="h-9 w-24"
              value={priceInputs.min}
              onChange={(e) => setPriceInputs((p) => ({ ...p, min: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-soft" htmlFor="max-price">
              Max price
            </label>
            <Input
              id="max-price"
              type="number"
              min={0}
              className="h-9 w-24"
              value={priceInputs.max}
              onChange={(e) => setPriceInputs((p) => ({ ...p, max: e.target.value }))}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Apply
          </Button>
        </form>

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={query.inStock === true}
            onChange={(e) => patch({ inStock: e.target.checked ? true : undefined })}
            className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-200"
          />
          In stock only
        </label>

        {activeFilterCount > 0 && (
          <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-sm text-slate hover:text-ink">
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      {status === 'loading' && <ProductGridSkeleton count={12} />}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

      {status === 'success' && products.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title="No products found"
          description="Try a different search term or clear your filters."
          action={
            activeFilterCount > 0 || query.q ? (
              <Button size="sm" variant="secondary" onClick={() => { setSearchInput(''); clearFilters(); }}>
                Clear search & filters
              </Button>
            ) : undefined
          }
        />
      )}

      {status === 'success' && products.length > 0 && (
        <>
          <p className="mb-3 text-xs text-slate">{meta.total} product{meta.total === 1 ? '' : 's'}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
          <div className="mt-8">
            <Pagination meta={meta} onPageChange={(page) => patch({ page }, { resetPage: false })} />
          </div>
        </>
      )}
    </div>
  );
}
