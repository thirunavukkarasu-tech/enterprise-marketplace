import { Card } from '../ui/Card';

export function ProductCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <div className="aspect-square animate-pulse bg-slate-100" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100" />
      </div>
    </Card>
  );
}

/** Matches the exact grid breakpoints used by ProductListing, CategoryBrowse,
 * and Wishlist so the skeleton-to-content transition doesn't reflow. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
