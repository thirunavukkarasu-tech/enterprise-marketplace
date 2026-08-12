import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { useAppDispatch } from '../../hooks/useAppStore';
import { registerUser } from '../../features/auth/authSlice';
import { cn } from '../../utils/cn';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
  role: z.enum(['customer', 'vendor']),
});

type RegisterForm = z.infer<typeof registerSchema>;

export function Register() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { role: 'customer' } });

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    const result = await dispatch(registerUser(values));

    if (registerUser.fulfilled.match(result)) {
      navigate('/login', { state: { justRegistered: true }, replace: true });
    } else {
      setServerError((result.payload as string) ?? 'Registration failed. Please try again.');
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-ink">Create your account</h1>
      <p className="mb-5 text-sm text-slate">Shop, or start selling on MarketSphere.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField label="I want to" htmlFor="role">
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {(['customer', 'vendor'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => field.onChange(option)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors',
                      field.value === option
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-ink-soft hover:border-indigo-300'
                    )}
                  >
                    {option === 'customer' ? 'Shop' : 'Sell'}
                  </button>
                ))}
              </div>
            )}
          />
        </FormField>

        <FormField label="Full name" htmlFor="name">
          <Input id="name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        </FormField>

        <FormField label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        </FormField>

        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
        </FormField>

        {serverError && (
          <p role="alert" className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">
            {serverError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
