import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FormField } from '../common/FormField';
import type { Address, AddressInput } from '../../types/cart';

const addressSchema = z.object({
  label: z.enum(['home', 'work', 'other']),
  fullName: z.string().trim().min(2, 'At least 2 characters').max(150),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(1, 'Required').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'Required').max(100),
  state: z.string().trim().min(1, 'Required').max(100),
  country: z.string().trim().min(1, 'Required').max(100),
  postalCode: z.string().trim().min(1, 'Required').max(20),
});

interface AddressFormProps {
  initial?: Address;
  onSubmit: (values: AddressInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function AddressForm({ initial, onSubmit, onCancel, submitLabel = 'Save address' }: AddressFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: initial
      ? {
          label: initial.label,
          fullName: initial.fullName,
          phone: initial.phone,
          line1: initial.line1,
          line2: initial.line2 ?? '',
          city: initial.city,
          state: initial.state,
          country: initial.country,
          postalCode: initial.postalCode,
        }
      : { label: 'home' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField label="Label" htmlFor="label">
        <select id="label" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...register('label')}>
          <option value="home">Home</option>
          <option value="work">Work</option>
          <option value="other">Other</option>
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Full name" htmlFor="fullName">
          <Input id="fullName" error={errors.fullName?.message} {...register('fullName')} />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" error={errors.phone?.message} {...register('phone')} />
        </FormField>
      </div>

      <FormField label="Address line 1" htmlFor="line1">
        <Input id="line1" error={errors.line1?.message} {...register('line1')} />
      </FormField>
      <FormField label="Address line 2 (optional)" htmlFor="line2">
        <Input id="line2" {...register('line2')} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="City" htmlFor="city">
          <Input id="city" error={errors.city?.message} {...register('city')} />
        </FormField>
        <FormField label="State" htmlFor="state">
          <Input id="state" error={errors.state?.message} {...register('state')} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Country" htmlFor="country">
          <Input id="country" error={errors.country?.message} {...register('country')} />
        </FormField>
        <FormField label="Postal code" htmlFor="postalCode">
          <Input id="postalCode" error={errors.postalCode?.message} {...register('postalCode')} />
        </FormField>
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
