import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/common/FormField';
import { useAppDispatch } from '../../hooks/useAppStore';
import { loginUser } from '../../features/auth/authSlice';
import { homePathForRole } from '../../utils/roleHome';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    const result = await dispatch(loginUser(values));

    if (loginUser.fulfilled.match(result)) {
      const redirectTo = (location.state as { from?: string })?.from ?? homePathForRole(result.payload.user.role);
      navigate(redirectTo, { replace: true });
    } else {
      setServerError((result.payload as string) ?? 'Login failed. Please try again.');
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-ink">Sign in</h1>
      <p className="mb-5 text-sm text-slate">Welcome back to MarketSphere.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        </FormField>

        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
        </FormField>

        {serverError && (
          <p role="alert" className="rounded-md bg-coral-100 px-3 py-2 text-sm text-coral-600">
            {serverError}
          </p>
        )}

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate">
        New to MarketSphere?{' '}
        <Link to="/register" className="font-medium text-indigo-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
