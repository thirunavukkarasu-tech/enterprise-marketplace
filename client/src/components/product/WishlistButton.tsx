import { Heart } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import { addToWishlist, removeFromWishlist } from '../../features/wishlist/wishlistSlice';
import { cn } from '../../utils/cn';

interface WishlistButtonProps {
  productId: string;
  className?: string;
}

/**
 * Only rendered functionally for signed-in customers — wishlisting is a
 * customer-role feature server-side (see server/src/routes/v1/wishlist.route.js),
 * so a vendor/admin/delivery-partner viewing a product (or a signed-out
 * guest) sees nothing here at all, rather than a button that would just
 * 403 or redirect to login on click.
 */
export function WishlistButton({ productId, className }: WishlistButtonProps) {
  const dispatch = useAppDispatch();
  const { status: authStatus, user } = useAppSelector((s) => s.auth);
  const { productIds } = useAppSelector((s) => s.wishlist);

  if (authStatus !== 'authenticated' || user?.role !== 'customer') {
    return null;
  }

  const isWishlisted = productIds.includes(productId);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); // don't follow the parent <Link> to the product page
    e.stopPropagation();
    if (isWishlisted) {
      dispatch(removeFromWishlist(productId));
    } else {
      dispatch(addToWishlist(productId));
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={isWishlisted}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-panel transition-colors hover:text-coral-500',
        isWishlisted && 'text-coral-500',
        className
      )}
    >
      <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
    </button>
  );
}
