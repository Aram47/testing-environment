import { Format } from '../lib/format';
import type { TestResult } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';

interface TestResultsTableProps {
  results: TestResult[];
  onSelect: (result: TestResult) => void;
}

export function TestResultsTable({ results, onSelect }: TestResultsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Suite</th>
            <th className="px-4 py-3">Test</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Method</th>
            <th className="px-4 py-3">Path</th>
            <th className="px-4 py-3">Expected</th>
            <th className="px-4 py-3">Actual</th>
            <th className="px-4 py-3">Attempts</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {results.map((result) => (
            <tr key={result.id}>
              <td className="px-4 py-3"><StatusBadge status={result.status} /></td>
              <td className="px-4 py-3">{result.suiteName}</td>
              <td className="px-4 py-3">{result.testName}</td>
              <td className="px-4 py-3">{result.stepType ?? 'apiRequest'}</td>
              <td className="px-4 py-3 font-mono text-xs">{result.method}</td>
              <td className="px-4 py-3 font-mono text-xs">{result.path}</td>
              <td className="px-4 py-3">{result.expectedStatus}</td>
              <td className="px-4 py-3">{result.actualStatus ?? '—'}</td>
              <td className="px-4 py-3">{result.attempts ?? 1}</td>
              <td className="px-4 py-3">{Format.duration(result.durationMs)}</td>
              <td className="px-4 py-3">
                <Button variant="secondary" className="min-h-9 px-3" onClick={() => onSelect(result)}>
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
