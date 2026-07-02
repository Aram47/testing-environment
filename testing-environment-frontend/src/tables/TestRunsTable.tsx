import { Format } from '../lib/format';
import type { TestRun } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LinkButton } from '../components/ui/LinkButton';

export function TestRunsTable({ projectId, runs }: { projectId: string; runs: TestRun[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Run ID</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Started</th>
            <th className="px-4 py-3">Finished</th>
            <th className="px-4 py-3">Tests</th>
            <th className="px-4 py-3">Passed</th>
            <th className="px-4 py-3">Failed</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Report</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="px-4 py-3 font-mono text-xs">{run.id}</td>
              <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
              <td className="px-4 py-3">{Format.date(run.startedAt)}</td>
              <td className="px-4 py-3">{Format.date(run.finishedAt)}</td>
              <td className="px-4 py-3">{run.totalTests}</td>
              <td className="px-4 py-3 text-emerald-700">{run.passed}</td>
              <td className="px-4 py-3 text-red-700">{run.failed}</td>
              <td className="px-4 py-3">{Format.duration(run.durationMs)}</td>
              <td className="px-4 py-3">
                <LinkButton variant="secondary" className="min-h-9 px-3" to={`/projects/${projectId || run.projectId}/runs/${run.id}`}>
                  View
                </LinkButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
