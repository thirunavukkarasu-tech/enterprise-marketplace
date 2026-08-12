import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ImageOff, ChevronLeft, PackageCheck, PackageX } from 'lucide-react';
import { productApi } from '../../features/catalog/productApi';
import type { Product, ProductVariant } from '../../types/catalog';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!slug) return;
    setStatus('loading');
    productApi
      .getPublicBySlug(slug)
      .then((data) => {
        setProduct(data);
        setSelectedVariant(data.variants[0] ?? null);
        setStatus('succeeded');
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setError(anyErr.response?.data?.message ?? 'This product could not be found.');
        setStatus('failed');
      });
  };

  useEffect(load, [slug]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (status === 'failed' || !product) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <ErrorState message={error ?? 'This product could not be found.'} onRetry={load} />
      </div>
    );
  }

  const image = product.images[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/products" className="mb-6 inline-flex items-center gap-1 text-sm text-slate hover:text-ink">
        <ChevronLeft size={15} /> Back to shop
      </Link>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-100">
          {image ? (
            <img src={image.url} alt={image.alt || product.title} className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="text-slate" size={40} />
          )}
        </div>

        <div>
          <p className="text-sm text-slate">{product.category.name}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{product.title}</h1>
          <p className="mt-1 text-sm text-slate">Sold by {product.vendor.name}</p>

          {selectedVariant && (
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold text-ink">
                {formatPrice(selectedVariant.price)}
              </span>
              {selectedVariant.compareAtPrice && selectedVariant.compareAtPrice > selectedVariant.price && (
                <span className="font-mono text-sm text-slate line-through">
                  {formatPrice(selectedVariant.compareAtPrice)}
                </span>
              )}
            </div>
          )}

          {product.variants.length > 1 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-ink-soft">Options</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant._id}
                    onClick={() => setSelectedVariant(variant)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      selectedVariant?._id === variant._id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-ink-soft hover:border-indigo-300'
                    )}
                  >
                    {Object.values(variant.attributes).join(' / ') || variant.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2 text-sm">
            {selectedVariant && selectedVariant.availableStock > 0 ? (
              <>
                <PackageCheck size={16} className="text-emerald-500" />
                <span className="text-emerald-600">In stock ({selectedVariant.availableStock} available)</span>
              </>
            ) : (
              <>
                <PackageX size={16} className="text-coral-500" />
                <span className="text-coral-600">Out of stock</span>
              </>
            )}
          </div>

          <Button size="lg" className="mt-6 w-full sm:w-auto" disabled={!selectedVariant || selectedVariant.availableStock === 0}>
            Add to cart
          </Button>
          <p className="mt-2 text-xs text-slate">Cart and checkout ship in Phase 6.</p>

          {product.description && (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <h2 className="mb-2 text-sm font-semibold text-ink">Description</h2>
              <p className="whitespace-pre-line text-sm text-ink-soft">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
