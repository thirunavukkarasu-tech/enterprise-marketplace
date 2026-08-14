import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { Product } from '../../types/catalog';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function ProductCard({ product }: { product: Product }) {
  const cover = product.images[0];
  const totalAvailable = product.variants.reduce((sum, v) => sum + v.availableStock, 0);
  const categoryName = typeof product.category === 'string' ? undefined : product.category.name;

  return (
    <Link to={`/products/${product.slug}`}>
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-panel-lg">
        <div className="flex aspect-square items-center justify-center bg-slate-100">
          {cover ? (
            <img src={cover.url} alt={cover.alt ?? product.title} className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="text-slate" size={28} />
          )}
        </div>
        <div className="p-4">
          {categoryName && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">{categoryName}</p>}
          <h3 className="line-clamp-2 text-sm font-medium text-ink group-hover:text-indigo-600">{product.title}</h3>
          <div className="mt-2 flex items-center justify-between">
            <p className="font-mono text-sm font-semibold text-ink">
              {product.priceRange.min === product.priceRange.max
                ? formatPrice(product.priceRange.min)
                : `${formatPrice(product.priceRange.min)} – ${formatPrice(product.priceRange.max)}`}
            </p>
            {totalAvailable === 0 ? (
              <Badge tone="coral">Out of stock</Badge>
            ) : totalAvailable <= 5 ? (
              <Badge tone="marigold">Low stock</Badge>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
