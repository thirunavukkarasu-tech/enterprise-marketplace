import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { authApi } from '../../features/auth/authApi';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

type Form = z.infer<typeof schema>;

export function ForgotPassword() {
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    // The API intentionally returns the same message whether or not the
    // account exists — this page just relays it, it doesn't need its own
    // success/failure branching.
    const resultMessage = await authApi.forgotPassword(values.email).catch(() => null);
    setMessage(resultMessage ?? 'If an account with that email exists, a reset link has been sent.');
  };

  if (message) {
    return (
      <div>
        <h1 className="mb-2 text-lg font-semibold text-ink">Check your email</h1>
        <p className="text-sm text-slate">{message}</p>
        <Link to="/login" className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-ink">Reset your password</h1>
      <p className="mb-5 text-sm text-slate">We'll email you a link to reset it.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        </FormField>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
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
