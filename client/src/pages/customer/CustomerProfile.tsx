import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ShieldCheck, ShieldAlert, MapPin, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/common/Spinner';
import { authApi, type AuthUser } from '../../features/auth/authApi';
import { userApi } from '../../features/user/userApi';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function CustomerProfile() {
  const [user, setUser] = useState<AuthUser | null>(null);
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
    authApi
      .me()
      .then((u) => {
        setUser(u);
        reset({ name: u.name, phone: u.phone ?? '' });
      })
      .catch(() => setServerError('Could not load your profile.'))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (values: ProfileForm) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      const updated = await userApi.updateOwnProfile({ name: values.name, phone: values.phone || undefined });
      setUser(updated);
      setSuccessMessage('Profile updated.');
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

  if (!user) {
    return <p className="mx-auto max-w-xl px-6 py-20 text-sm text-coral-600">{serverError}</p>;
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Account</h1>

      <Card className="mb-6">
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail size={15} className="text-slate" />
            <span className="text-ink-soft">{user.email}</span>
            {user.isEmailVerified ? (
              <Badge tone="emerald">
                <ShieldCheck size={12} /> verified
              </Badge>
            ) : (
              <Badge tone="marigold">
                <ShieldAlert size={12} /> unverified
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate">
            Email address changes aren't supported yet — this would need its own re-verification flow.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Personal details</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormField label="Full name" htmlFor="name">
              <Input id="name" error={errors.name?.message} {...register('name')} />
            </FormField>
            <FormField label="Phone (optional)" htmlFor="phone">
              <Input id="phone" error={errors.phone?.message} {...register('phone')} />
            </FormField>

            {serverError && <p className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">{serverError}</p>}
            {successMessage && <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-600">{successMessage}</p>}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {user.role === 'customer' && (
        <Link to="/addresses" className="mt-6 block">
          <Card className="transition-shadow hover:shadow-panel-lg">
            <CardBody className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <MapPin size={16} className="text-slate" /> Manage addresses
              </span>
              <ChevronRight size={16} className="text-slate" />
            </CardBody>
          </Card>
        </Link>
      )}
    </div>
  );
}
