import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { companiesApi } from '../api/companies.api';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { UsageCard } from '../components/ui/UsageCard';
import { useAuth } from '../features/auth/authContext';
import { ErrorPresenter } from '../lib/errors';
import { useToast } from '../components/ui/toastContext';

interface CompanyFormValues {
  name: string;
}

export function CompanySettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const query = useQuery({ queryKey: ['company', 'me'], queryFn: companiesApi.me });
  const canEdit = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanyFormValues>({ defaultValues: { name: '' } });

  useEffect(() => {
    if (query.data) {
      reset({ name: query.data.name });
    }
  }, [query.data, reset]);

  const mutation = useMutation({
    mutationFn: companiesApi.updateMe,
    onSuccess: async (company) => {
      await queryClient.invalidateQueries({ queryKey: ['company', 'me'] });
      reset({ name: company.name });
      showToast('Company settings updated', 'success');
    },
    onError: (error) => {
      setError('root', { message: ErrorPresenter.message(error) });
    },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate({ name: values.name });
  });

  if (query.isLoading) {
    return <LoadingState label="Loading company settings" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const company = query.data;
  if (!company) {
    return <ErrorState error={new Error('Company data is empty')} />;
  }

  const { plan } = company;

  return (
    <>
      <PageHeader title="Company settings" description="Workspace identity, plan limits, and current usage." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Company" value={company.name} />
        <StatCard label="Members" value={company.membersCount} />
        <StatCard label="Plan" value={plan.tier} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <UsageCard label="Projects used" current={plan.usage.projectsUsed} max={plan.maxProjects} />
        <UsageCard label="Runs this month" current={plan.usage.runsThisMonth} max={plan.maxRunsPerMonth} />
        <UsageCard label="Concurrent runs" current={plan.usage.concurrentRuns} max={plan.maxConcurrentRuns} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Workspace profile</h2>
          <p className="mt-1 text-sm text-muted">
            {canEdit ? 'Update the company profile name.' : 'Only owners and admins can edit the company profile.'}
          </p>
          {canEdit ? (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Company name</span>
                <input
                  className="input"
                  autoComplete="organization"
                  aria-invalid={Boolean(errors.name)}
                  {...register('name', {
                    required: 'Company name is required',
                    minLength: { value: 2, message: 'Company name must be at least 2 characters' },
                  })}
                />
              </label>
              {errors.name?.message ? <p className="text-sm text-red-700">{errors.name.message}</p> : null}
              {errors.root?.message ? <p className="text-sm text-red-700">{errors.root.message}</p> : null}
              <Button type="submit" disabled={isSubmitting || mutation.isPending || !isDirty}>
                {mutation.isPending ? 'Saving...' : 'Save company'}
              </Button>
            </form>
          ) : (
            <div className="mt-5 rounded-md border border-border bg-slate-50 p-4 text-sm text-muted">{company.name}</div>
          )}
        </section>
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Plan limits</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <CompanyDetail label="Max projects" value={plan.maxProjects} />
            <CompanyDetail label="Monthly runs" value={plan.maxRunsPerMonth} />
            <CompanyDetail label="Concurrent runs" value={plan.maxConcurrentRuns} />
            <CompanyDetail label="Runner minutes" value={plan.maxRunnerMinutes} />
            <CompanyDetail label="Retention days" value={plan.reportRetentionDays} />
          </dl>
        </section>
      </div>
    </>
  );
}

function CompanyDetail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
