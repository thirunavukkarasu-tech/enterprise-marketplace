import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Truck, ClipboardCheck, ChevronLeft, ChevronRight, AlertTriangle, Plus, CheckCircle2 } from 'lucide-react';
import { useAppSelector } from '../../hooks/useAppStore';
import { addressApi } from '../../features/address/addressApi';
import { checkoutApi } from '../../features/checkout/checkoutApi';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { AddressForm } from '../../components/checkout/AddressForm';
import type { Address, AddressInput, CheckoutSummary, ShippingMethod } from '../../types/cart';
import { cn } from '../../utils/cn';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const STEPS = [
  { key: 'contact', label: 'Contact' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'review', label: 'Review' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const SHIPPING_OPTIONS: { value: ShippingMethod; label: string; blurb: string }[] = [
  { value: 'standard', label: 'Standard', blurb: '5–7 business days · Free' },
  { value: 'express', label: 'Express', blurb: '1–2 business days' },
];

function StepIndicator({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-8 flex items-center gap-2">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              i < currentIndex ? 'bg-emerald-500 text-white' : i === currentIndex ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate'
            )}
          >
            {i < currentIndex ? <CheckCircle2 size={14} /> : i + 1}
          </span>
          <span className={cn('text-sm font-medium', i <= currentIndex ? 'text-ink' : 'text-slate')}>{step.label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );
}

export function Checkout() {
  const navigate = useNavigate();
  const { cart } = useAppSelector((s) => s.cart);

  const [step, setStep] = useState<StepKey>('contact');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressStatus, setAddressStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const loadAddresses = () => {
    setAddressStatus('loading');
    addressApi
      .list()
      .then((list) => {
        setAddresses(list);
        setAddressStatus('success');
        const preferred = list.find((a) => a.isDefaultShipping) ?? list[0];
        if (preferred) setSelectedAddressId((current) => current ?? preferred._id);
      })
      .catch(() => setAddressStatus('error'));
  };

  useEffect(loadAddresses, []);

  // A cart empty of any real content shouldn't be checking out at all —
  // send the customer back rather than showing a broken review step.
  useEffect(() => {
    if (cart && cart.items.length === 0) {
      navigate('/cart', { replace: true });
    }
  }, [cart, navigate]);

  const goToReview = async () => {
    if (!selectedAddressId) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const result = await checkoutApi.review({ shippingAddressId: selectedAddressId, shippingMethod });
      setSummary(result);
      setStep('review');
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setReviewError(anyErr.response?.data?.message ?? 'Could not prepare your order review.');
    } finally {
      setReviewing(false);
    }
  };

  if (!cart) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Checkout</h1>
      <p className="mb-6 text-sm text-slate">
        This prepares your order for review — placing the order and paying arrive in a later phase.
      </p>

      <StepIndicator current={step} />

      {step === 'contact' && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <h2 className="font-medium text-ink">Contact information</h2>
            <p className="text-sm text-slate">Order updates will be sent to your account email and phone.</p>
            <Button onClick={() => setStep('shipping')} className="self-end">
              Continue <ChevronRight size={16} />
            </Button>
          </CardBody>
        </Card>
      )}

      {step === 'shipping' && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-ink">Shipping address</h2>
              {!showAddressForm && (
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
                >
                  <Plus size={14} /> New address
                </button>
              )}
            </div>

            {addressStatus === 'loading' && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}

            {addressStatus === 'success' && addresses.length === 0 && !showAddressForm && (
              <EmptyState
                icon={MapPin}
                title="No saved addresses"
                description="Add a shipping address to continue."
                action={
                  <Button size="sm" onClick={() => setShowAddressForm(true)}>
                    <Plus size={14} /> Add address
                  </Button>
                }
              />
            )}

            {showAddressForm && (
              <AddressForm
                submitLabel="Save and use this address"
                onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
                onSubmit={async (values: AddressInput) => {
                  const created = await addressApi.create(values);
                  setAddresses((prev) => [created, ...prev]);
                  setSelectedAddressId(created._id);
                  setShowAddressForm(false);
                }}
              />
            )}

            {!showAddressForm &&
              addresses.map((address) => (
                <label
                  key={address._id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm',
                    selectedAddressId === address._id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                  )}
                >
                  <input
                    type="radio"
                    name="shippingAddress"
                    className="mt-1"
                    checked={selectedAddressId === address._id}
                    onChange={() => setSelectedAddressId(address._id)}
                  />
                  <span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium capitalize text-ink">{address.label}</span>
                      {address.isDefaultShipping && <Badge tone="indigo">Default</Badge>}
                    </span>
                    <span className="block text-ink-soft">{address.fullName} · {address.phone}</span>
                    <span className="block text-ink-soft">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postalCode}, {address.country}
                    </span>
                  </span>
                </label>
              ))}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep('contact')}>
                <ChevronLeft size={16} /> Back
              </Button>
              <Button onClick={() => setStep('delivery')} disabled={!selectedAddressId}>
                Continue <ChevronRight size={16} />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'delivery' && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <h2 className="font-medium text-ink">Delivery method</h2>
            {SHIPPING_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm',
                  shippingMethod === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shippingMethod"
                    checked={shippingMethod === opt.value}
                    onChange={() => setShippingMethod(opt.value)}
                  />
                  <Truck size={16} className="text-ink-soft" />
                  <span>
                    <span className="block font-medium text-ink">{opt.label}</span>
                    <span className="block text-xs text-slate">{opt.blurb}</span>
                  </span>
                </span>
              </label>
            ))}

            {reviewError && <p className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{reviewError}</p>}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep('shipping')}>
                <ChevronLeft size={16} /> Back
              </Button>
              <Button onClick={goToReview} disabled={reviewing}>
                {reviewing ? 'Preparing review…' : 'Review order'} <ChevronRight size={16} />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'review' && summary && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 font-medium text-ink">
              <ClipboardCheck size={18} /> Order review
            </h2>

            {!summary.canProceed && (
              <div className="flex items-start gap-2 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>Some items in your cart need attention. Go back to your cart to resolve them before continuing.</span>
              </div>
            )}
            {summary.hasPriceChanges && summary.canProceed && (
              <div className="flex items-start gap-2 rounded-md bg-marigold-100 px-3 py-2 text-sm text-marigold-600">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{summary.priceChangeMessage}</span>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate">Shipping to</p>
              <p className="text-sm text-ink-soft">
                {summary.shippingAddress.fullName}, {summary.shippingAddress.line1}, {summary.shippingAddress.city},{' '}
                {summary.shippingAddress.state} {summary.shippingAddress.postalCode}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate">Items ({summary.itemCount})</p>
              <ul className="mt-1 divide-y divide-slate-200">
                {summary.items.map((item) => (
                  <li key={item.itemId} className="flex justify-between py-2 text-sm">
                    <span className="text-ink-soft">
                      {item.title} × {item.quantity}
                    </span>
                    <span className="font-mono text-ink">{formatPrice(item.lineSubtotal)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span className="font-mono">{formatPrice(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Shipping</span>
                <span className="font-mono">{summary.shippingFee > 0 ? formatPrice(summary.shippingFee) : 'Free'}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Tax</span>
                <span className="font-mono">{formatPrice(summary.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-ink">
                <span>Total</span>
                <span className="font-mono">{formatPrice(summary.grandTotal)}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep('delivery')}>
                <ChevronLeft size={16} /> Back
              </Button>
              <Button disabled={!summary.canProceed} title="Order placement and payment arrive in a later phase">
                Place order (coming soon)
              </Button>
            </div>
            <p className="text-center text-xs text-slate">
              This is a checkout preview only — order placement and payment aren't wired up yet.
            </p>
          </CardBody>
        </Card>
      )}

      <p className="mt-6 text-center text-sm text-slate">
        <Link to="/cart" className="text-indigo-600 hover:underline">
          Back to cart
        </Link>
      </p>
    </div>
  );
}
