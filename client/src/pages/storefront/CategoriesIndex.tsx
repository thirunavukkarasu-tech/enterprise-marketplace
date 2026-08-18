import { Link } from 'react-router-dom';
import { FolderTree } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';

export function CategoriesIndex() {
  const { categories, status, error, refetch } = useCategories({ withCounts: true });
  const topLevel = categories.filter((c) => !c.parent);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Breadcrumbs items={[{ label: 'Shop', to: '/products' }, { label: 'Categories' }]} />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-slate">Browse the full catalog by category.</p>
      </header>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

      {status === 'success' && topLevel.length === 0 && (
        <EmptyState icon={FolderTree} title="No categories yet" description="Check back soon." />
      )}

      {status === 'success' && topLevel.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {topLevel.map((category) => (
            <Link key={category._id} to={`/categories/${category._id}`}>
              <Card className="flex h-28 flex-col items-center justify-center gap-2 text-center transition-shadow hover:shadow-panel-lg">
                <FolderTree size={20} className="text-indigo-500" />
                <span className="px-2 text-sm font-medium text-ink">{category.name}</span>
                {category.productCount !== undefined && (
                  <span className="text-xs text-slate">{category.productCount} products</span>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
