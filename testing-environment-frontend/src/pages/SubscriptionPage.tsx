import { PageHeader } from '../components/ui/PageHeader';
import { UsageCard } from '../components/ui/UsageCard';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../features/auth/authContext';

export function SubscriptionPage() {
  const { user } = useAuth();
  const plan = user?.company?.plan;
  const usage = plan?.usage;

  return (
    <>
      <PageHeader title="Subscription" description="Current plan limits and usage for the workspace." />
      {!plan ? (
        <section className="rounded-lg border border-border bg-white p-6 text-sm text-muted">Subscription data is not available.</section>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Plan" value={plan.tier} />
            <StatCard label="Max projects" value={plan.maxProjects} />
            <StatCard label="Monthly runs" value={plan.maxRunsPerMonth} />
            <StatCard label="Retention days" value={plan.reportRetentionDays} />
          </div>
          {usage ? (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <UsageCard label="Projects used" current={usage.projectsUsed} max={plan.maxProjects} />
              <UsageCard label="Runs this month" current={usage.runsThisMonth} max={plan.maxRunsPerMonth} />
              <UsageCard label="Concurrent runs" current={usage.concurrentRuns} max={plan.maxConcurrentRuns} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
