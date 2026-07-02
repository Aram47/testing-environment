import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { ErrorPresenter } from '../lib/errors';
import { useToast } from '../components/ui/toastContext';
import { useAuth } from '../features/auth/authContext';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = loginSchema.extend({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  companyName: z.string().min(2),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const submit = async (values: LoginValues) => {
    try {
      await login(values);
      showToast('Logged in successfully', 'success');
      navigate('/dashboard');
    } catch (error) {
      setError('root', { message: ErrorPresenter.message(error) });
    }
  };

  return (
    <AuthShell title="Sign in" footer={<Link to="/register">Create account</Link>}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <AuthField label="Email" error={errors.email?.message}>
          <input className="input" type="email" autoComplete="email" {...register('email')} />
        </AuthField>
        <AuthField label="Password" error={errors.password?.message}>
          <input className="input" type="password" autoComplete="current-password" {...register('password')} />
        </AuthField>
        {errors.root?.message ? <p className="text-sm text-red-700">{errors.root.message}</p> : null}
        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterForm() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const submit = async (values: RegisterValues) => {
    try {
      await createAccount(values);
      showToast('Workspace created', 'success');
      navigate('/dashboard');
    } catch (error) {
      setError('root', { message: ErrorPresenter.message(error) });
    }
  };

  return (
    <AuthShell title="Create workspace" footer={<Link to="/login">Already have an account?</Link>}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField label="First name" error={errors.firstName?.message}>
            <input className="input" autoComplete="given-name" {...register('firstName')} />
          </AuthField>
          <AuthField label="Last name" error={errors.lastName?.message}>
            <input className="input" autoComplete="family-name" {...register('lastName')} />
          </AuthField>
        </div>
        <AuthField label="Company" error={errors.companyName?.message}>
          <input className="input" autoComplete="organization" {...register('companyName')} />
        </AuthField>
        <AuthField label="Email" error={errors.email?.message}>
          <input className="input" type="email" autoComplete="email" {...register('email')} />
        </AuthField>
        <AuthField label="Password" error={errors.password?.message}>
          <input className="input" type="password" autoComplete="new-password" {...register('password')} />
        </AuthField>
        {errors.root?.message ? <p className="text-sm text-red-700">{errors.root.message}</p> : null}
        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, footer, children }: { title: string; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">Backend Test Runner</p>
        <div className="mt-8">{children}</div>
        <p className="mt-6 text-center text-sm font-medium text-brand">{footer}</p>
      </section>
    </main>
  );
}

function AuthField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
  );
}
