import { ShoppingBag, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { DirectoryStrip } from '../../components/common/DirectoryStrip';

const placeholderCategories = ['Home & Living', 'Electronics', 'Fashion', 'Handmade', 'Grocery', 'Books'];

export function StorefrontHome() {
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
            <Button size="lg">
              <ShoppingBag size={18} /> Browse products
            </Button>
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
          <span className="text-sm text-slate">Product catalog arrives in Phase 3</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {placeholderCategories.map((cat) => (
            <Card key={cat} className="flex h-24 items-center justify-center text-center">
              <span className="px-2 text-sm font-medium text-ink-soft">{cat}</span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
