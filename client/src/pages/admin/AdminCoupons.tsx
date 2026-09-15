import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Tag, X } from 'lucide-react';
import { useCoupons } from '../../hooks/useCoupons';
import { couponApi } from '../../features/coupon/couponApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import type { CouponListQuery } from '../../types/coupon';

const couponFormSchema = z
  .object({
    code: z.string().trim().min(3, 'At least 3 characters').max(30),
    description: z.string().trim().max(500).optional(),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.coerce.number().positive('Must be greater than 0'),
    maxDiscountAmount: z.coerce.number().positive().optional(),
    minOrderValue: z.coerce.number().min(0).optional(),
    startsAt: z.string().optional(),
    expiresAt: z.string().optional(),
    usageLimit: z.coerce.number().int().positive().optional(),
    perUserLimit: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => data.discountType !== 'percentage' || data.discountValue <= 100, {
    message: 'Percentage discount cannot exceed 100',
    path: ['discountValue'],
  });

type CouponForm = z.infer<typeof couponFormSchema>;

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function AdminCoupons() {
  const [query, setQuery] = useState<CouponListQuery>({ page: 1, limit: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const { coupons, meta, status, error, refetch } = useCoupons(query);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CouponForm>({ resolver: zodResolver(couponFormSchema), defaultValues: { discountType: 'percentage' } });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((q) => ({ ...q, q: searchInput || undefined, page: 1 }));
  };

  const onSubmit = async (values: CouponForm) => {
    setServerError(null);
    try {
      await couponApi.create({
        code: values.code.toUpperCase(),
        description: values.description || undefined,
        discountType: values.discountType,
        discountValue: values.discountValue,
        maxDiscountAmount: values.maxDiscountAmount || null,
        minOrderValue: values.minOrderValue || 0,
        startsAt: values.startsAt || null,
        expiresAt: values.expiresAt || null,
        usageLimit: values.usageLimit || null,
        perUserLimit: values.perUserLimit || null,
      });
      reset();
      setShowForm(false);
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setServerError(anyErr.response?.data?.message ?? 'Could not create this coupon.');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setRowError(null);
    try {
      await couponApi.setActive(id, !isActive);
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setRowError(anyErr.response?.data?.message ?? 'Could not update this coupon.');
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Delete coupon "${code}"? This cannot be undone.`)) return;
    setRowError(null);
    try {
      await couponApi.remove(id);
      refetch();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setRowError(anyErr.response?.data?.message ?? 'Could not delete this coupon.');
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Coupons</h1>
          <p className="text-sm text-slate">Create and manage discount codes.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New coupon'}
        </Button>
      </header>

      {showForm && (
        <Card className="mb-6">
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-3">
              <FormField label="Code" htmlFor="code">
                <Input id="code" className="font-mono uppercase" error={errors.code?.message} {...register('code')} />
              </FormField>
              <FormField label="Discount type" htmlFor="discountType">
                <select id="discountType" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...register('discountType')}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </FormField>
              <FormField label="Discount value" htmlFor="discountValue">
                <Input id="discountValue" type="number" step="0.01" error={errors.discountValue?.message} {...register('discountValue')} />
              </FormField>
              <FormField label="Max discount amount (optional)" htmlFor="maxDiscountAmount">
                <Input id="maxDiscountAmount" type="number" step="0.01" {...register('maxDiscountAmount')} />
              </FormField>
              <FormField label="Minimum order value (optional)" htmlFor="minOrderValue">
                <Input id="minOrderValue" type="number" step="0.01" {...register('minOrderValue')} />
              </FormField>
              <FormField label="Description (optional)" htmlFor="description">
                <Input id="description" {...register('description')} />
              </FormField>
              <FormField label="Starts at (optional)" htmlFor="startsAt">
                <Input id="startsAt" type="date" {...register('startsAt')} />
              </FormField>
              <FormField label="Expires at (optional)" htmlFor="expiresAt">
                <Input id="expiresAt" type="date" {...register('expiresAt')} />
              </FormField>
              <FormField label="Total usage limit (optional)" htmlFor="usageLimit">
                <Input id="usageLimit" type="number" {...register('usageLimit')} />
              </FormField>
              <FormField label="Per-customer usage limit (optional)" htmlFor="perUserLimit">
                <Input id="perUserLimit" type="number" {...register('perUserLimit')} />
              </FormField>

              {serverError && (
                <p className="col-span-full rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{serverError}</p>
              )}
              <div className="col-span-full flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create coupon'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <form onSubmit={submitSearch} className="mb-6 flex max-w-sm gap-2">
        <Input
          placeholder="Search coupon code…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search coupons"
          className="font-mono uppercase"
        />
        <button type="submit" className="rounded-md border border-slate-200 px-3 text-sm text-ink-soft hover:bg-slate-100">
          Search
        </button>
      </form>

      {rowError && <p className="mb-4 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{rowError}</p>}

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === 'error' && <ErrorState message={error ?? 'Something went wrong.'} onRetry={refetch} />}

      {status === 'success' && coupons.length === 0 && (
        <EmptyState icon={Tag} title="No coupons yet" description="Create one to start offering discounts." />
      )}

      {status === 'success' && coupons.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {coupons.map((coupon) => (
                  <tr key={coupon._id}>
                    <td className="px-4 py-3 font-mono font-medium text-ink">{coupon.code}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatPrice(coupon.discountValue)}
                      {coupon.maxDiscountAmount && (
                        <span className="text-xs text-slate"> (max {formatPrice(coupon.maxDiscountAmount)})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-soft">
                      {coupon.usageCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={coupon.isActive ? 'emerald' : 'neutral'}>{coupon.isActive ? 'active' : 'inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => toggleActive(coupon._id, coupon.isActive)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-ink-soft hover:bg-slate-100"
                        >
                          {coupon.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(coupon._id, coupon.code)}
                          className="rounded-md border border-coral-100 px-2 py-1 text-xs font-medium text-coral-600 hover:bg-coral-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-6">
            <Pagination meta={meta} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
          </div>
        </>
      )}
    </div>
  );
}
