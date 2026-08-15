import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Store } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/common/Spinner';
import { VendorStatusBadge } from '../../components/vendor/VendorStatusBadge';
import { Badge } from '../../components/ui/Badge';
import { vendorApi } from '../../features/vendor/vendorApi';
import type { Vendor } from '../../types/vendor';

const profileSchema = z.object({
  storeName: z.string().trim().min(2, 'At least 2 characters').max(150),
  legalBusinessName: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  businessEmail: z.string().trim().toLowerCase().email('Enter a valid email address'),
  businessPhone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(1, 'Required').max(200),
  line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(1, 'Required').max(100),
  state: z.string().trim().min(1, 'Required').max(100),
  country: z.string().trim().min(1, 'Required').max(100),
  postalCode: z.string().trim().min(1, 'Required').max(20),
  taxId: z.string().trim().max(50).optional().or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

function toFormValues(vendor: Vendor): ProfileForm {
  return {
    storeName: vendor.storeName,
    legalBusinessName: vendor.legalBusinessName ?? '',
    description: vendor.description ?? '',
    businessEmail: vendor.businessEmail,
    businessPhone: vendor.businessPhone,
    line1: vendor.address.line1,
    line2: vendor.address.line2 ?? '',
    city: vendor.address.city,
    state: vendor.address.state,
    country: vendor.address.country,
    postalCode: vendor.address.postalCode,
    taxId: vendor.taxId ?? '',
  };
}

function toPayload(values: ProfileForm) {
  return {
    storeName: values.storeName,
    legalBusinessName: values.legalBusinessName || undefined,
    description: values.description || undefined,
    businessEmail: values.businessEmail,
    businessPhone: values.businessPhone,
    address: {
      line1: values.line1,
      line2: values.line2 || undefined,
      city: values.city,
      state: values.state,
      country: values.country,
      postalCode: values.postalCode,
    },
    taxId: values.taxId || undefined,
  };
}

export function VendorProfile() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    vendorApi
      .getOwnProfile()
      .then((v) => {
        setVendor(v);
        reset(toFormValues(v));
      })
      .catch((err) => {
        const anyErr = err as { response?: { status?: number } };
        if (anyErr.response?.status !== 404) {
          setServerError('Could not load your store profile.');
        }
      })
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (values: ProfileForm) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      const payload = toPayload(values);
      const saved = vendor ? await vendorApi.updateOwnProfile(payload) : await vendorApi.createOwnProfile(payload);
      setVendor(saved);
      setSuccessMessage(vendor ? 'Profile updated.' : 'Store profile submitted for review.');
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setServerError(anyErr.response?.data?.message ?? 'Could not save your profile.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Store profile</h1>
          <p className="text-sm text-slate">
            {vendor ? 'Update your business information.' : 'Tell us about your business to start selling.'}
          </p>
        </div>
        {vendor && (
          <div className="flex items-center gap-2">
            <VendorStatusBadge status={vendor.status} />
            {vendor.isVerified && <Badge tone="indigo">verified</Badge>}
          </div>
        )}
      </header>

      {!vendor && (
        <div className="mb-6 flex items-start gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
          <Store size={16} className="mt-0.5 shrink-0" />
          <span>Your store starts in review once submitted. You can browse and prepare products in the meantime.</span>
        </div>
      )}

      {vendor?.status === 'rejected' && vendor.rejectionReason && (
        <div className="mb-6 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">
          <strong>Application rejected:</strong> {vendor.rejectionReason}
        </div>
      )}
      {vendor?.status === 'suspended' && (
        <div className="mb-6 rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">
          <strong>Store suspended.</strong> {vendor.suspensionReason ?? 'Contact support for details.'}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <h2 className="font-medium">Business details</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <FormField label="Store name" htmlFor="storeName">
              <Input id="storeName" error={errors.storeName?.message} {...register('storeName')} />
            </FormField>
            <FormField label="Legal business name (optional)" htmlFor="legalBusinessName">
              <Input id="legalBusinessName" error={errors.legalBusinessName?.message} {...register('legalBusinessName')} />
            </FormField>
            <FormField label="Description (optional)" htmlFor="description">
              <textarea
                id="description"
                rows={3}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                {...register('description')}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Business email" htmlFor="businessEmail">
                <Input id="businessEmail" type="email" error={errors.businessEmail?.message} {...register('businessEmail')} />
              </FormField>
              <FormField label="Business phone" htmlFor="businessPhone">
                <Input id="businessPhone" error={errors.businessPhone?.message} {...register('businessPhone')} />
              </FormField>
            </div>
            <FormField label="Tax / business registration ID (optional)" htmlFor="taxId">
              <Input id="taxId" error={errors.taxId?.message} {...register('taxId')} />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-medium">Business address</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
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
          </CardBody>
        </Card>

        {serverError && <p className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{serverError}</p>}
        {successMessage && <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-600">{successMessage}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : vendor ? 'Save changes' : 'Submit for review'}
          </Button>
        </div>
      </form>
    </div>
  );
}
