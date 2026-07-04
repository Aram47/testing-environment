import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { companiesApi } from '../api/companies.api';
import { subscriptionsApi } from '../api/subscriptions.api';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { UsageCard } from '../components/ui/UsageCard';
import { StatCard } from '../components/ui/StatCard';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';
import type { CompanyUsage, SubscriptionPlan, SubscriptionTier } from '../types';

export function SubscriptionPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const companyQuery = useQuery({ queryKey: ['company', 'me'], queryFn: companiesApi.me });
  const plansQuery = useQuery({ queryKey: ['subscriptions', 'plans'], queryFn: subscriptionsApi.listPlans });
  const changePlanMutation = useMutation({
    mutationFn: (planName: SubscriptionTier) => subscriptionsApi.changePlan(planName),
    onSuccess: async (company) => {
      showToast(`Subscription changed to ${company.plan.tier}`, 'success');
      setSelectedPlan(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['company', 'me'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (companyQuery.isLoading || plansQuery.isLoading) {
    return <LoadingState label="Loading subscription" />;
  }

  if (companyQuery.isError) {
    return <ErrorState error={companyQuery.error} />;
  }

  if (plansQuery.isError) {
    return <ErrorState error={plansQuery.error} />;
  }

  const company = companyQuery.data;
  if (!company) {
    return <ErrorState error={new Error('Subscription data is empty')} />;
  }

  const plan = company.plan;
  const usage = plan.usage;
  const plans = plansQuery.data ?? [];
  const selectedPlanWarning = selectedPlan ? downgradeWarning(selectedPlan, usage) : undefined;

  return (
    <>
      <PageHeader title="Subscription" description="Current plan limits and usage for the workspace." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Plan" value={plan.tier} />
        <StatCard label="Max projects" value={plan.maxProjects} />
        <StatCard label="Monthly runs" value={plan.maxRunsPerMonth} />
        <StatCard label="Retention days" value={plan.reportRetentionDays} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <UsageCard label="Projects used" current={usage.projectsUsed} max={plan.maxProjects} />
        <UsageCard label="Runs this month" current={usage.runsThisMonth} max={plan.maxRunsPerMonth} />
        <UsageCard label="Concurrent runs" current={usage.concurrentRuns} max={plan.maxConcurrentRuns} />
      </div>
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Available plans</h2>
            <p className="mt-1 text-sm text-muted">Change the workspace plan instantly while billing is mocked.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {plans.map((availablePlan) => (
            <PlanCard
              key={availablePlan.tier}
              plan={availablePlan}
              currentPlanTier={plan.tier}
              usage={usage}
              isChanging={changePlanMutation.isPending}
              onSelect={setSelectedPlan}
            />
          ))}
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(selectedPlan)}
        title="Change subscription plan"
        description={selectedPlan ? confirmationText(selectedPlan, selectedPlanWarning) : ''}
        confirmLabel={changePlanMutation.isPending ? 'Changing...' : 'Change plan'}
        onCancel={() => setSelectedPlan(null)}
        onConfirm={() => {
          if (selectedPlan) {
            changePlanMutation.mutate(selectedPlan.tier);
          }
        }}
      />
    </>
  );
}

function PlanCard({
  plan,
  currentPlanTier,
  usage,
  isChanging,
  onSelect,
}: {
  plan: SubscriptionPlan;
  currentPlanTier: SubscriptionTier;
  usage: CompanyUsage;
  isChanging: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
}) {
  const isCurrent = plan.tier === currentPlanTier;
  const warning = downgradeWarning(plan, usage);

  return (
    <article className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">{plan.tier}</h3>
          <p className="mt-1 text-sm text-muted">{isCurrent ? 'Current plan' : 'Fake plan switch'}</p>
        </div>
        {isCurrent ? <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-ink">Current</span> : null}
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <PlanLimit label="Projects" value={plan.maxProjects} />
        <PlanLimit label="Monthly runs" value={plan.maxRunsPerMonth} />
        <PlanLimit label="Concurrent runs" value={plan.maxConcurrentRuns} />
        <PlanLimit label="Runner minutes" value={plan.maxRunnerMinutes ?? '—'} />
        <PlanLimit label="Retention days" value={plan.reportRetentionDays} />
      </dl>
      {warning ? <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">{warning}</p> : null}
      <Button type="button" className="mt-5 w-full" variant={isCurrent ? 'secondary' : 'primary'} disabled={isCurrent || isChanging} onClick={() => onSelect(plan)}>
        {isCurrent ? 'Current plan' : 'Change plan'}
      </Button>
    </article>
  );
}

function PlanLimit({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

function downgradeWarning(plan: SubscriptionPlan, usage: CompanyUsage): string | undefined {
  if (usage.projectsUsed > plan.maxProjects) {
    return 'Current project usage exceeds this plan limit. Backend will block this change.';
  }
  if (usage.runsThisMonth > plan.maxRunsPerMonth) {
    return 'Current monthly run usage exceeds this plan limit. Backend will block this change.';
  }
  if (usage.concurrentRuns > plan.maxConcurrentRuns) {
    return 'Current concurrent run usage exceeds this plan limit. Backend will block this change.';
  }
  return undefined;
}

function confirmationText(plan: SubscriptionPlan, warning?: string): string {
  return warning
    ? `${warning} You can still try, but the server will reject unsafe downgrades.`
    : `This will immediately switch the workspace to the ${plan.tier} plan. Billing is mocked for now.`;
}
