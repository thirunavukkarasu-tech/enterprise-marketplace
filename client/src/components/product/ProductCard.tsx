import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { Product } from '../../types/catalog';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { WishlistButton } from './WishlistButton';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function ProductCard({ product }: { product: Product }) {
  const cover = product.images[0];
  const totalAvailable = product.variants.reduce((sum, v) => sum + v.availableStock, 0);
  const categoryName = typeof product.category === 'string' ? undefined : product.category.name;
  const compareAt = product.variants[0]?.compareAtPrice;
  const showCompareAt = compareAt && compareAt > product.priceRange.min;

  return (
    <Card className="group relative h-full overflow-hidden transition-shadow hover:shadow-panel-lg">
      <WishlistButton productId={product._id} className="absolute right-2 top-2 z-10" />
      <Link to={`/products/${product.slug}`}>
        <div className="flex aspect-square items-center justify-center bg-slate-100">
          {cover ? (
            <img src={cover.url} alt={cover.alt ?? product.title} className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="text-slate" size={28} />
          )}
        </div>
        <div className="p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            {categoryName && <p className="text-xs font-medium uppercase tracking-wide text-slate">{categoryName}</p>}
            {product.vendorStore && (
              <p className="truncate text-xs text-slate" title={product.vendorStore.storeName}>
                {product.vendorStore.storeName}
              </p>
            )}
          </div>
          <h3 className="line-clamp-2 text-sm font-medium text-ink group-hover:text-indigo-600">{product.title}</h3>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <p className="font-mono text-sm font-semibold text-ink">
                {product.priceRange.min === product.priceRange.max
                  ? formatPrice(product.priceRange.min)
                  : `${formatPrice(product.priceRange.min)} – ${formatPrice(product.priceRange.max)}`}
              </p>
              {showCompareAt && (
                <p className="font-mono text-xs text-slate line-through">{formatPrice(compareAt)}</p>
              )}
            </div>
            {totalAvailable === 0 ? (
              <Badge tone="coral">Out of stock</Badge>
            ) : totalAvailable <= 5 ? (
              <Badge tone="marigold">Low stock</Badge>
            ) : null}
          </div>
        </div>
      </Link>
    </Card>
  );
}
