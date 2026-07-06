import { Link } from 'react-router-dom';
import { Format } from '../../lib/format';
import type { TestRunComparison } from '../../types';

export function RunComparisonPanel({
  comparison,
  projectId,
}: {
  comparison: TestRunComparison;
  projectId: string;
}) {
  if (!comparison.baselineRun) {
    return (
      <section className="rounded-lg border border-border bg-white p-5 text-sm text-muted shadow-sm">
        No previous successful run found for comparison.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Comparison with last successful run</h2>
          <p className="text-sm text-muted">
            Baseline{' '}
            <Link className="text-brand underline" to={`/projects/${projectId}/runs/${comparison.baselineRun.id}`}>
              {comparison.baselineRun.id}
            </Link>
            {comparison.baselineRun.finishedAt
              ? ` · ${Format.date(comparison.baselineRun.finishedAt)}`
              : ''}
          </p>
        </div>
        <div className="text-sm text-muted">
          {comparison.summary.stepsWithStatusChange} status changes ·{' '}
          {comparison.summary.stepsWithTimingRegression} timing regressions
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ComparisonCard
          title="Environment revision"
          changed={comparison.revisions.environment.changed}
          current={formatRevision(comparison.revisions.environment.current)}
          baseline={formatRevision(comparison.revisions.environment.baseline)}
        />
        <ComparisonCard
          title="Image references"
          changed={comparison.imageReferences.some((entry) => entry.changed)}
          current={comparison.imageReferences.map((entry) => `${entry.serviceName}: ${entry.current ?? '—'}`).join('\n') || '—'}
          baseline={comparison.imageReferences.map((entry) => `${entry.serviceName}: ${entry.baseline ?? '—'}`).join('\n') || '—'}
        />
      </div>

      {comparison.revisions.suites.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="px-3 py-2">Suite</th>
                <th className="px-3 py-2">Current</th>
                <th className="px-3 py-2">Baseline</th>
              </tr>
            </thead>
            <tbody>
              {comparison.revisions.suites.map((suite) => (
                <tr key={suite.suiteName} className="border-b border-border">
                  <td className="px-3 py-2 font-medium">{suite.suiteName}</td>
                  <td className="px-3 py-2">#{suite.currentRevisionNumber ?? '—'}</td>
                  <td className={`px-3 py-2 ${suite.changed ? 'text-amber-800' : ''}`}>
                    #{suite.baselineRevisionNumber ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {comparison.stepDiffs.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Response</th>
                <th className="px-3 py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {comparison.stepDiffs.map((diff) => (
                <tr
                  key={diff.stepId ?? diff.testName}
                  className={`border-b border-border ${diff.statusChanged || (diff.durationRegressionPercent ?? 0) > 20 ? 'bg-amber-50/60' : ''}`}
                >
                  <td className="px-3 py-2 font-medium">{diff.testName}</td>
                  <td className="px-3 py-2">
                    {diff.currentStatus ?? '—'}
                    {diff.baselineStatus ? ` vs ${diff.baselineStatus}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    {diff.currentActualStatus ?? '—'}
                    {diff.baselineActualStatus !== undefined ? ` vs ${diff.baselineActualStatus}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    {diff.currentDurationMs ?? '—'} ms
                    {diff.durationRegressionPercent !== undefined
                      ? ` (${diff.durationRegressionPercent > 0 ? '+' : ''}${Math.round(diff.durationRegressionPercent)}%)`
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ComparisonCard({
  title,
  changed,
  current,
  baseline,
}: {
  title: string;
  changed: boolean;
  current: string;
  baseline: string;
}) {
  return (
    <article className="rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {changed ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            Changed
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
            Same
          </span>
        )}
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <div>
          <dt className="text-xs uppercase text-muted">Current</dt>
          <dd className="whitespace-pre-wrap font-mono text-xs">{current}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted">Baseline</dt>
          <dd className="whitespace-pre-wrap font-mono text-xs">{baseline}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatRevision(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '—';
  }
  const revision = value as { revisionNumber?: number; id?: string };
  if (revision.revisionNumber !== undefined) {
    return `#${revision.revisionNumber}`;
  }
  return revision.id ?? '—';
}
