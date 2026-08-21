import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, Trash2, ImageOff, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppStore';
import { fetchCart, updateCartItemQuantity, removeCartItem, clearCart } from '../../features/cart/cartSlice';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import type { CartItem, CartItemIssue } from '../../types/cart';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const ISSUE_COPY: Record<CartItemIssue, string> = {
  product_unavailable: 'No longer available',
  variant_unavailable: 'This option is no longer available',
  out_of_stock: 'Out of stock',
  insufficient_stock: 'Not enough stock for this quantity',
  price_changed: 'Price has changed since you added this',
};

function CartLineItem({ item }: { item: CartItem }) {
  const dispatch = useAppDispatch();
  const { mutating } = useAppSelector((s) => s.cart);

  const isBlocking =
    item.issue === 'product_unavailable' ||
    item.issue === 'variant_unavailable' ||
    item.issue === 'out_of_stock' ||
    item.issue === 'insufficient_stock';

  const changeQty = (next: number) => {
    if (next < 1) return;
    dispatch(updateCartItemQuantity({ itemId: item.itemId, quantity: next }));
  };

  return (
    <div className="flex gap-4 border-b border-slate-200 py-4 last:border-0">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-slate-100">
        {item.image ? (
          <img src={item.image.url} alt={item.image.alt ?? item.title ?? ''} className="h-full w-full rounded-md object-cover" />
        ) : (
          <ImageOff className="text-slate" size={20} />
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{item.title ?? 'Product unavailable'}</p>
            <p className="font-mono text-xs text-slate">SKU: {item.sku}</p>
          </div>
          <button
            type="button"
            onClick={() => dispatch(removeCartItem(item.itemId))}
            disabled={mutating}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-coral-600 hover:bg-coral-100 disabled:opacity-40"
            aria-label="Remove item"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {item.issue && (
          <p className="mt-1 flex items-center gap-1 text-xs text-coral-600">
            <AlertTriangle size={12} /> {ISSUE_COPY[item.issue]}
            {item.issue === 'insufficient_stock' && ` — only ${item.availableStock} left`}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeQty(item.quantity - 1)}
              disabled={mutating || isBlocking || item.quantity <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-ink-soft hover:bg-slate-100 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus size={12} />
            </button>
            <span className="w-6 text-center font-mono text-sm">{item.quantity}</span>
            <button
              type="button"
              onClick={() => changeQty(item.quantity + 1)}
              disabled={mutating || isBlocking || item.quantity >= item.availableStock}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-ink-soft hover:bg-slate-100 disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="text-right">
            {item.currentPrice !== null && (
              <p className="font-mono text-sm font-semibold text-ink">{formatPrice(item.lineSubtotal)}</p>
            )}
            {item.issue === 'price_changed' && (
              <p className="font-mono text-xs text-slate line-through">
                was {formatPrice(item.priceSnapshot * item.quantity)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Cart() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { cart, status, error, mutating } = useAppSelector((s) => s.cart);

  useEffect(() => {
    dispatch(fetchCart(undefined));
  }, [dispatch]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <ErrorState message={error ?? 'Failed to load your cart.'} onRetry={() => dispatch(fetchCart(undefined))} />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse the catalog and add something you like."
          action={
            <Link to="/products">
              <Button size="sm">Browse products</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your cart</h1>
        <button
          type="button"
          onClick={() => dispatch(clearCart())}
          disabled={mutating}
          className="text-sm font-medium text-coral-600 hover:underline disabled:opacity-40"
        >
          Clear cart
        </button>
      </header>

      {cart.priceChangeMessage && (
        <div className="mb-6 flex items-start gap-2 rounded-md bg-marigold-100 px-3 py-2 text-sm text-marigold-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{cart.priceChangeMessage}</span>
        </div>
      )}

      {error && <p className="mb-4 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{error}</p>}

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <Card>
          <CardBody>
            {cart.items.map((item) => (
              <CartLineItem key={item.itemId} item={item} />
            ))}
          </CardBody>
        </Card>

        <div>
          <Card>
            <CardBody className="flex flex-col gap-3">
              <h2 className="font-medium text-ink">Order summary</h2>
              <div className="flex justify-between text-sm text-ink-soft">
                <span>Subtotal ({cart.itemCount} items)</span>
                <span className="font-mono">{formatPrice(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-soft">
                <span>Discount</span>
                <span className="font-mono">{cart.discountAmount > 0 ? `-${formatPrice(cart.discountAmount)}` : formatPrice(0)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-soft">
                <span>Tax</span>
                <span className="font-mono">{formatPrice(cart.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-soft">
                <span>Shipping</span>
                <span className="font-mono">{cart.shippingFee > 0 ? formatPrice(cart.shippingFee) : 'Free'}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-ink">
                <span>Total</span>
                <span className="font-mono">{formatPrice(cart.grandTotal)}</span>
              </div>

              {cart.hasBlockingIssues && (
                <Badge tone="coral" className="w-fit">
                  Resolve item issues to continue
                </Badge>
              )}

              <Button
                size="lg"
                className="mt-2"
                disabled={cart.hasBlockingIssues || mutating}
                onClick={() => navigate('/checkout')}
              >
                Proceed to checkout <ArrowRight size={16} />
              </Button>
              <Link to="/products" className="text-center text-sm text-indigo-600 hover:underline">
                Continue shopping
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
