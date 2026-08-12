import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { authApi } from '../../features/auth/authApi';

const schema = z.object({
  newPassword: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

type Form = z.infer<typeof schema>;

export function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    if (!token) return;
    setServerError(null);
    try {
      await authApi.resetPassword({ token, newPassword: values.newPassword });
      navigate('/login', { state: { passwordReset: true }, replace: true });
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setServerError(anyErr.response?.data?.message ?? 'That reset link is invalid or has expired.');
    }
  };

  if (!token) {
    return <p className="text-sm text-coral-600">This reset link is missing a token.</p>;
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-ink">Choose a new password</h1>
      <p className="mb-5 text-sm text-slate">This will sign you out of all other devices.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField label="New password" htmlFor="newPassword">
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
        </FormField>

        {serverError && (
          <p role="alert" className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">
            {serverError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate">
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
