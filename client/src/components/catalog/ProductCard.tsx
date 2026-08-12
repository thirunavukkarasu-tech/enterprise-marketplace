import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Card } from '../ui/Card';
import type { Product } from '../../types/catalog';

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function ProductCard({ product }: { product: Product }) {
  const { min, max } = product.priceRange;
  const priceLabel = min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
  const image = product.images[0];

  return (
    <Link to={`/products/${product.slug}`}>
      <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-panel-lg">
        <div className="flex aspect-square items-center justify-center bg-slate-100">
          {image ? (
            <img src={image.url} alt={image.alt || product.title} className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="text-slate" size={28} />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="text-xs text-slate">{product.category.name}</p>
          <h3 className="line-clamp-2 text-sm font-medium text-ink">{product.title}</h3>
          <p className="mt-auto font-mono text-sm font-semibold text-ink">{priceLabel}</p>
          <p className="text-xs text-slate">by {product.vendor.name}</p>
        </div>
      </Card>
    </Link>
  );
}
