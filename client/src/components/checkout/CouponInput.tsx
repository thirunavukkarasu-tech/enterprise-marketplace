import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface CouponInputProps {
  appliedCode: string | null;
  couponError: string | null;
  discountAmount: number;
  mutating: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

/**
 * Deliberately dumb: takes the cart's already-server-calculated
 * `discountAmount`/`couponError`/`appliedCode` as props rather than
 * computing anything itself — this component never guesses what a
 * coupon is worth, it only reflects what the server already decided.
 */
export function CouponInput({ appliedCode, couponError, discountAmount, mutating, onApply, onRemove }: CouponInputProps) {
  const [code, setCode] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    onApply(code.trim());
    setCode('');
  };

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between rounded-md bg-emerald-100 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-emerald-700">
          <Tag size={14} />
          <span className="font-mono font-medium">{appliedCode}</span> applied
          {discountAmount > 0 && <span className="text-emerald-600">(-{formatPrice(discountAmount)})</span>}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={mutating}
          className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
          aria-label="Remove coupon"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Coupon code"
          aria-label="Coupon code"
          className="font-mono uppercase"
          disabled={mutating}
        />
        <Button type="submit" variant="secondary" disabled={mutating || !code.trim()}>
          Apply
        </Button>
      </form>
      {couponError && <p className="mt-1.5 text-xs text-coral-600">{couponError}</p>}
    </div>
  );
}
