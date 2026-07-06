import type { ConnectionState } from '../../api/test-run-events.client';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Format } from '../../lib/format';
import type { TestRunDetail } from '../../types';
import { ConnectionStateBadge } from './ConnectionStateBadge';

function resultLabel(status: TestRunDetail['diagnosis']['environmentResult']['status']): string {
  if (status === 'passed') return 'Passed';
  if (status === 'failed') return 'Failed';
  if (status === 'skipped') return 'Skipped';
  return 'Not reached';
}

function healthcheckLabel(status: TestRunDetail['diagnosis']['healthcheckResult']['status']): string {
  if (status === 'passed') return 'Passed';
  if (status === 'failed') return 'Failed';
  if (status === 'skipped') return 'Skipped';
  return 'Not reached';
}

export function RunSummaryHeader({
  run,
  connectionState,
}: {
  run: TestRunDetail;
  connectionState?: ConnectionState;
}) {
  const { diagnosis } = run;
  const isFailed = ['TEST_FAILED', 'INFRA_FAILED', 'TIMED_OUT', 'CANCELLED'].includes(run.status);

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">Run summary</h2>
            <StatusBadge status={run.status} />
            {connectionState ? <ConnectionStateBadge state={connectionState} /> : null}
          </div>
          {isFailed ? (
            <p className="text-sm font-medium text-red-700">{diagnosis.headline}</p>
          ) : (
            <p className="text-sm text-muted">{diagnosis.headline}</p>
          )}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Environment" value={resultLabel(diagnosis.environmentResult.status)} />
          <SummaryItem label="Healthcheck" value={healthcheckLabel(diagnosis.healthcheckResult.status)} />
          <SummaryItem label="Tests" value={`${run.passed} passed / ${run.failed} failed`} />
          <SummaryItem label="Duration" value={Format.duration(run.durationMs)} />
          <SummaryItem label="Failure category" value={diagnosis.failureCategory ?? '—'} />
          <SummaryItem label="Runner" value={run.runnerVersion ?? run.runnerId ?? 'local'} />
          <SummaryItem
            label="Environment revision"
            value={
              run.environmentConfigRevision
                ? `#${run.environmentConfigRevision.revisionNumber}`
                : 'Not recorded'
            }
          />
          <SummaryItem
            label="Suite revisions"
            value={run.suiteRevisions?.length ? String(run.suiteRevisions.length) : '0'}
          />
        </dl>
      </div>
      {run.suiteRevisions?.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {run.suiteRevisions.map((snapshot) => (
            <article key={snapshot.id} className="rounded-md border border-border p-3 text-sm">
              <div className="font-semibold text-ink">{snapshot.suiteName}</div>
              <div className="text-muted">Revision #{snapshot.testSuiteRevision.revisionNumber}</div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
