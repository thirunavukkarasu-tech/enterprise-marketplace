import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ImageOff, ChevronLeft } from 'lucide-react';
import { productApi } from '../../features/catalog/productApi';
import type { Product, ProductVariant } from '../../types/catalog';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

type Status = 'loading' | 'success' | 'error' | 'not-found';

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setStatus('loading');
    productApi
      .getPublicBySlug(slug)
      .then((p) => {
        setProduct(p);
        setSelectedSku(p.variants[0]?.sku ?? null);
        setStatus('success');
      })
      .catch((err) => {
        const anyErr = err as { response?: { status?: number; data?: { message?: string } } };
        if (anyErr.response?.status === 404) {
          setStatus('not-found');
        } else {
          setError(anyErr.response?.data?.message ?? 'Failed to load this product.');
          setStatus('error');
        }
      });
  }, [slug]);

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
        <h1 className="text-lg font-semibold text-ink">Product not found</h1>
        <p className="mt-1 text-sm text-slate">It may have been removed or is no longer available.</p>
        <Link to="/products" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to shop
        </Link>
      </div>
    );
  }

  if (status === 'error' || !product) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <ErrorState message={error ?? 'Something went wrong.'} />
      </div>
    );
  }

  const variant: ProductVariant | undefined =
    product.variants.find((v) => v.sku === selectedSku) ?? product.variants[0];
  const categoryName = typeof product.category === 'string' ? undefined : product.category.name;
  const cover = product.images[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/products" className="mb-6 inline-flex items-center gap-1 text-sm text-slate hover:text-ink">
        <ChevronLeft size={16} /> Back to shop
      </Link>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100">
          {cover ? (
            <img src={cover.url} alt={cover.alt ?? product.title} className="h-full w-full rounded-lg object-cover" />
          ) : (
            <ImageOff className="text-slate" size={36} />
          )}
        </div>

        <div>
          {categoryName && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">{categoryName}</p>}
          <h1 className="text-2xl font-semibold text-ink">{product.title}</h1>

          {variant && (
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold text-ink">{formatPrice(variant.price)}</span>
              {variant.compareAtPrice && variant.compareAtPrice > variant.price && (
                <span className="font-mono text-sm text-slate line-through">{formatPrice(variant.compareAtPrice)}</span>
              )}
            </div>
          )}

          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{product.description}</p>

          {product.variants.length > 1 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-ink-soft">Options</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.sku}
                    type="button"
                    onClick={() => setSelectedSku(v.sku)}
                    disabled={v.availableStock === 0}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      v.sku === selectedSku ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-ink-soft hover:border-indigo-300'
                    )}
                  >
                    {v.attributes ? Object.values(v.attributes).join(' / ') : v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            {variant && variant.availableStock === 0 ? (
              <Badge tone="coral">Out of stock</Badge>
            ) : variant && variant.availableStock <= 5 ? (
              <Badge tone="marigold">Only {variant.availableStock} left</Badge>
            ) : (
              <Badge tone="emerald">In stock</Badge>
            )}
            <span className="font-mono text-xs text-slate">SKU: {variant?.sku}</span>
          </div>

          <Button size="lg" className="mt-6" disabled={!variant || variant.availableStock === 0}>
            Add to cart
          </Button>
          <p className="mt-2 text-xs text-slate">Cart and checkout arrive in Phase 6.</p>
        </div>
      </div>
    </div>
  );
}
