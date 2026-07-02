import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { CreateProjectInput, Project } from '../types';
import { Button } from '../components/ui/Button';

const schema = z.object({
  name: z.string().min(2, 'Project name is required'),
  description: z.string().optional(),
  baseUrl: z.string().url('Enter a valid URL'),
  mainServiceName: z.string().min(1, 'Main service is required'),
  healthcheckPath: z.string().startsWith('/', 'Path must start with /'),
  healthcheckExpectedStatus: z.coerce.number().int().min(100).max(599),
  healthcheckTimeoutSeconds: z.coerce.number().int().min(1).max(600),
});

interface ProjectFormProps {
  initialValue?: Project;
  isSubmitting: boolean;
  onSubmit: (value: CreateProjectInput) => void;
}

export function ProjectForm({ initialValue, isSubmitting, onSubmit }: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialValue?.name ?? '',
      description: initialValue?.description ?? '',
      baseUrl: initialValue?.baseUrl ?? 'http://host.docker.internal:8000',
      mainServiceName: initialValue?.mainServiceName ?? 'api',
      healthcheckPath: initialValue?.healthcheckPath ?? '/status/200',
      healthcheckExpectedStatus: initialValue?.healthcheckExpectedStatus ?? 200,
      healthcheckTimeoutSeconds: initialValue?.healthcheckTimeoutSeconds ?? 60,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 rounded-lg border border-border bg-white p-6 shadow-sm">
      <Field label="Project name" error={errors.name?.message}>
        <input className="input" {...register('name')} autoComplete="off" />
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <textarea className="input min-h-24" {...register('description')} />
      </Field>
      <Field label="Base URL" error={errors.baseUrl?.message}>
        <input className="input" {...register('baseUrl')} inputMode="url" />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Main service name" error={errors.mainServiceName?.message}>
          <input className="input" {...register('mainServiceName')} />
        </Field>
        <Field label="Healthcheck path" error={errors.healthcheckPath?.message}>
          <input className="input" {...register('healthcheckPath')} />
        </Field>
        <Field label="Expected status" error={errors.healthcheckExpectedStatus?.message}>
          <input className="input" type="number" {...register('healthcheckExpectedStatus')} />
        </Field>
        <Field label="Timeout seconds" error={errors.healthcheckTimeoutSeconds?.message}>
          <input className="input" type="number" {...register('healthcheckTimeoutSeconds')} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save project'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
  );
}
