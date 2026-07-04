import { Clock3, SearchCheck, Send } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Format } from '../../lib/format';
import type { TestResult } from '../../types';

export function TestRunTimeline({ results }: { results: TestResult[] }) {
  if (results.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-white p-5 text-sm text-muted shadow-sm">
        Timeline will appear after the first step finishes.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Execution timeline</h2>
        <p className="text-sm text-muted">{results.length} finished steps</p>
      </div>
      <ol className="space-y-3">
        {results.map((result) => (
          <li key={result.id} className="flex gap-3 rounded-md border border-border p-3">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-50 text-brand">
              {result.stepType === 'wait' ? <Clock3 size={18} /> : result.stepType === 'pollUntil' ? <SearchCheck size={18} /> : <Send size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">{result.testName}</p>
                <StatusBadge status={result.status} />
              </div>
              <p className="mt-1 truncate font-mono text-xs text-muted">
                {result.method} {result.path}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                <span>{stepTypeLabel(result.stepType)}</span>
                <span>{Format.duration(result.durationMs)}</span>
                <span>{result.attempts ?? 1} attempt{(result.attempts ?? 1) === 1 ? '' : 's'}</span>
              </div>
              {result.errorMessage ? <p className="mt-2 text-sm font-medium text-red-700">{result.errorMessage}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function stepTypeLabel(stepType: TestResult['stepType']): string {
  if (stepType === 'wait') {
    return 'Wait';
  }
  if (stepType === 'pollUntil') {
    return 'Poll until';
  }
  return 'API request';
}
