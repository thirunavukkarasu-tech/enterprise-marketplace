import { Link } from 'react-router-dom';
import { ShoppingBag, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { DirectoryStrip } from '../../components/common/DirectoryStrip';
import { useCategories } from '../../hooks/useCategories';
import { Spinner } from '../../components/common/Spinner';

export function StorefrontHome() {
  const { categories, status } = useCategories();
  const topLevel = categories.filter((c) => !c.parent).slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <section className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            One marketplace.
            <br />
            Hundreds of independent sellers.
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-soft">
            MarketSphere connects vendors directly to customers — with real inventory,
            real order tracking, and a marketplace built to scale past the first hundred sellers.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/products">
              <Button size="lg">
                <ShoppingBag size={18} /> Browse products
              </Button>
            </Link>
            <Button size="lg" variant="secondary">
              Become a vendor
            </Button>
          </div>
        </div>

        <Card className="p-1">
          <CardBody>
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-soft">
              <Search size={16} /> Every account type, one platform
            </p>
            <DirectoryStrip />
          </CardBody>
        </Card>
      </section>

      <section className="mt-16">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Shop by category</h2>
          <Link to="/products" className="text-sm text-indigo-600 hover:underline">
            View all
          </Link>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {status === 'success' && topLevel.length === 0 && (
          <p className="text-sm text-slate">No categories yet — check back soon.</p>
        )}

        {status === 'success' && topLevel.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {topLevel.map((category) => (
              <Link key={category._id} to={`/products?category=${category._id}`}>
                <Card className="flex h-24 items-center justify-center text-center transition-shadow hover:shadow-panel-lg">
                  <span className="px-2 text-sm font-medium text-ink-soft">{category.name}</span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
