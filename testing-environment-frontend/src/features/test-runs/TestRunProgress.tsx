import type { TestRun } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';

export function TestRunProgress({ run }: { run: TestRun }) {
  const complete = run.totalTests > 0 ? Math.round(((run.passed + run.failed) / run.totalTests) * 100) : 0;

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Run progress</h2>
        <StatusBadge status={run.status} />
      </div>
      <div className="mt-5 h-3 rounded-full bg-slate-100">
        <div className="h-3 rounded-full bg-brand transition-all" style={{ width: `${complete}%` }} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Total" value={run.totalTests} />
        <Metric label="Passed" value={run.passed} />
        <Metric label="Failed" value={run.failed} />
        <Metric label="Progress" value={`${complete}%`} />
      </div>
      {run.currentPhase || run.failureCategory || run.statusReason ? (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-muted">
          {run.currentPhase ? <p>Current phase: {run.currentPhase}</p> : null}
          {run.failureCategory ? <p>Failure category: {run.failureCategory}</p> : null}
          {run.statusReason ? <p className="text-ink">{run.statusReason}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
