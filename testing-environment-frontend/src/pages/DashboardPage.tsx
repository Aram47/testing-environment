import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api/projects.api';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { StatCard } from '../components/ui/StatCard';
import { UsageCard } from '../components/ui/UsageCard';
import { TestRunsTable } from '../tables/TestRunsTable';

export function DashboardPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: projectsApi.dashboard });

  if (query.isLoading) {
    return <LoadingState label="Loading dashboard" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const summary = query.data;
  if (!summary) {
    return <ErrorState error={new Error('Dashboard data is empty')} />;
  }
  const usage = summary.plan.usage;

  return (
    <>
      <PageHeader title="Dashboard" description="Workspace health, usage, and recent backend test activity." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total projects" value={summary.totalProjects} />
        <StatCard label="Passed tests" value={summary.passed} />
        <StatCard label="Failed tests" value={summary.failed} />
        <StatCard label="Plan" value={summary.plan.tier} />
      </div>
      {usage ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <UsageCard label="Runs this month" current={usage.runsThisMonth} max={summary.plan.maxRunsPerMonth} />
          <UsageCard label="Projects used" current={usage.projectsUsed} max={summary.plan.maxProjects} />
          <UsageCard label="Concurrent runs" current={usage.concurrentRuns} max={summary.plan.maxConcurrentRuns} />
        </div>
      ) : null}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Recent test runs</h2>
        <TestRunsTable projectId="" runs={summary.recentRuns} />
      </section>
    </>
  );
}
