import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ImageOff, CheckCircle2, ShieldCheck } from 'lucide-react';
import { productApi } from '../../features/catalog/productApi';
import { addCartItem } from '../../features/cart/cartSlice';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import type { Product, ProductVariant } from '../../types/catalog';
import { Spinner } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { WishlistButton } from '../../components/product/WishlistButton';
import { cn } from '../../utils/cn';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

type Status = 'loading' | 'success' | 'error' | 'not-found';

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const cartMutating = useAppSelector((s) => s.cart.mutating);
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setStatus('loading');
    productApi
      .getPublicBySlug(slug)
      .then((p) => {
        setProduct(p);
        // Only auto-select when there's a single variant — with more than
        // one, the customer must make an explicit choice (no silently
        // defaulted variant going into a cart later).
        setSelectedSku(p.variants.length === 1 ? p.variants[0].sku : null);
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

  const variant: ProductVariant | undefined = product.variants.find((v) => v.sku === selectedSku);
  const categoryName = typeof product.category === 'string' ? undefined : product.category.name;
  const categoryId = typeof product.category === 'string' ? undefined : product.category._id;
  const cover = product.images[0];
  const needsSelection = product.variants.length > 1;

  const handleAddToCart = async () => {
    if (!variant) {
      setSelectionError(true);
      return;
    }
    setSelectionError(false);
    setCartError(null);

    if (!user || user.role !== 'customer') {
      // Cart is a customer-role feature server-side (see
      // server/src/routes/v1/cart.route.js) — guests and other roles are
      // told plainly rather than sent into a request that would 401/403.
      setCartError(user ? 'Only customer accounts have a cart.' : 'Sign in as a customer to add items to your cart.');
      return;
    }

    const result = await dispatch(addCartItem({ productId: product!._id, sku: variant.sku, quantity: 1 }));
    if (addCartItem.fulfilled.match(result)) {
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2500);
    } else {
      setCartError((result.payload as string) ?? 'Could not add this item to your cart.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: 'Shop', to: '/products' },
          ...(categoryName && categoryId ? [{ label: categoryName, to: `/categories/${categoryId}` }] : []),
          { label: product.title },
        ]}
      />

      <div className="grid gap-10 md:grid-cols-2">
        <div className="relative flex aspect-square items-center justify-center rounded-lg bg-slate-100">
          <WishlistButton productId={product._id} className="absolute right-3 top-3" />
          {cover ? (
            <img src={cover.url} alt={cover.alt ?? product.title} className="h-full w-full rounded-lg object-cover" />
          ) : (
            <ImageOff className="text-slate" size={36} />
          )}
        </div>

        <div>
          {categoryName && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">{categoryName}</p>}
          <h1 className="text-2xl font-semibold text-ink">{product.title}</h1>

          {product.vendorStore && (
            <p className="mt-1 flex items-center gap-1 text-sm text-slate">
              Sold by <span className="font-medium text-ink-soft">{product.vendorStore.storeName}</span>
              {product.vendorStore.isVerified && <ShieldCheck size={13} className="text-indigo-500" />}
            </p>
          )}

          {variant && (
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold text-ink">{formatPrice(variant.price)}</span>
              {variant.compareAtPrice && variant.compareAtPrice > variant.price && (
                <span className="font-mono text-sm text-slate line-through">{formatPrice(variant.compareAtPrice)}</span>
              )}
            </div>
          )}
          {!variant && (
            <p className="mt-3 font-mono text-xl font-semibold text-ink">
              {product.priceRange.min === product.priceRange.max
                ? formatPrice(product.priceRange.min)
                : `${formatPrice(product.priceRange.min)} – ${formatPrice(product.priceRange.max)}`}
            </p>
          )}

          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{product.description}</p>

          {needsSelection && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-ink-soft">
                Options {selectionError && <span className="text-coral-600">— please select an option</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.sku}
                    type="button"
                    onClick={() => {
                      setSelectedSku(v.sku);
                      setSelectionError(false);
                    }}
                    disabled={v.availableStock === 0}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      v.sku === selectedSku
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : selectionError
                          ? 'border-coral-300'
                          : 'border-slate-200 text-ink-soft hover:border-indigo-300'
                    )}
                  >
                    {v.attributes ? Object.values(v.attributes).join(' / ') : v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            {variant ? (
              variant.availableStock === 0 ? (
                <Badge tone="coral">Out of stock</Badge>
              ) : variant.availableStock <= 5 ? (
                <Badge tone="marigold">Only {variant.availableStock} left</Badge>
              ) : (
                <Badge tone="emerald">In stock</Badge>
              )
            ) : (
              <Badge tone="neutral">Select an option to see availability</Badge>
            )}
            {variant && <span className="font-mono text-xs text-slate">SKU: {variant.sku}</span>}
          </div>

          <Button
            size="lg"
            className="mt-6"
            onClick={handleAddToCart}
            disabled={cartMutating || (variant !== undefined && variant.availableStock === 0)}
          >
            {addedToCart ? (
              <>
                <CheckCircle2 size={17} /> Added
              </>
            ) : cartMutating ? (
              'Adding…'
            ) : (
              'Add to cart'
            )}
          </Button>
          {cartError && <p className="mt-2 text-xs text-coral-600">{cartError}</p>}
          <p className="mt-2 text-xs text-slate">
            <Link to="/cart" className="text-indigo-600 hover:underline">
              View cart
            </Link>{' '}
            to review items and proceed to checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
