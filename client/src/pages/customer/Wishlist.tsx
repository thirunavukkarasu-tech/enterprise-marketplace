import { Heart } from 'lucide-react';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import { fetchWishlist } from '../../features/wishlist/wishlistSlice';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductGridSkeleton } from '../../components/product/ProductGridSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';

export function Wishlist() {
  const dispatch = useAppDispatch();
  const { products, status } = useAppSelector((s) => s.wishlist);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchWishlist());
  }, [status, dispatch]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Your wishlist</h1>
        <p className="text-sm text-slate">Products you've saved for later.</p>
      </header>

      {status === 'loading' && <ProductGridSkeleton count={4} />}

      {status === 'error' && <ErrorState message="Failed to load your wishlist." onRetry={() => dispatch(fetchWishlist())} />}

      {status === 'loaded' && products.length === 0 && (
        <EmptyState icon={Heart} title="Your wishlist is empty" description="Tap the heart on any product to save it here." />
      )}

      {status === 'loaded' && products.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
