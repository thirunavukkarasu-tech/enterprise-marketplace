import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { FolderTree, PackageSearch } from 'lucide-react';
import { categoryApi } from '../../features/catalog/categoryApi';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { Pagination } from '../../components/ui/Pagination';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { Card } from '../../components/ui/Card';
import type { Category } from '../../types/catalog';

type Status = 'loading' | 'success' | 'error' | 'not-found';

export function CategoryBrowse() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<Category | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const { categories: allCategories } = useCategories({ withCounts: true });
  const page = Number(searchParams.get('page') ?? '1');

  useEffect(() => {
    if (!id) return;
    setStatus('loading');
    categoryApi
      .getById(id)
      .then((c) => {
        setCategory(c);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { status?: number } };
        setStatus(anyErr.response?.status === 404 ? 'not-found' : 'error');
      });
  }, [id]);

  const subcategories = allCategories.filter((c) => c.parent === id);
  const { products, meta, status: productStatus, error, refetch } = useProducts({ category: id, page, limit: 12 });

  if (status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-lg font-semibold text-ink">Category not found</h1>
        <Link to="/products" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Browse all products
        </Link>
      </div>
    );
  }

  if (status === 'error' || !category) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <ErrorState message="Failed to load this category." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Breadcrumbs items={[{ label: 'Shop', to: '/products' }, { label: category.name }]} />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{category.name}</h1>
        {category.description && <p className="mt-1 text-sm text-slate">{category.description}</p>}
      </header>

      {subcategories.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Subcategories</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {subcategories.map((sub) => (
              <Link key={sub._id} to={`/categories/${sub._id}`}>
                <Card className="flex h-20 flex-col items-center justify-center gap-1 text-center transition-shadow hover:shadow-panel-lg">
                  <FolderTree size={16} className="text-indigo-500" />
                  <span className="px-2 text-xs font-medium text-ink-soft">{sub.name}</span>
                  {sub.productCount !== undefined && <span className="text-[10px] text-slate">{sub.productCount} items</span>}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Products</h2>

        {productStatus === 'loading' && <ProductGridSkeleton count={8} />}

        {productStatus === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

        {productStatus === 'success' && products.length === 0 && (
          <EmptyState icon={PackageSearch} title="No products in this category yet" description="Check back soon." />
        )}

        {productStatus === 'success' && products.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
            <div className="mt-8">
              <Pagination meta={meta} onPageChange={(p) => setSearchParams({ page: String(p) })} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
