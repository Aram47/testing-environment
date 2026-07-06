import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Format } from '../lib/format';
import type { TestResult } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';

interface TestResultsTableProps {
  results: TestResult[];
  onSelect: (result: TestResult) => void;
}

const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 52;

export function TestResultsTable({ results, onSelect }: TestResultsTableProps) {
  if (results.length <= VIRTUALIZE_THRESHOLD) {
    return (
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="min-w-full divide-y divide-border text-sm">
          <TableHead />
          <tbody className="divide-y divide-border">
            {results.map((result) => (
              <ResultRow key={result.id} result={result} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <VirtualizedResultsTable results={results} onSelect={onSelect} />;
}

function VirtualizedResultsTable({
  results,
  onSelect,
}: {
  results: TestResult[];
  onSelect: (result: TestResult) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="min-w-full divide-y divide-border text-sm">
        <TableHead />
      </table>
      <div ref={parentRef} className="max-h-[32rem] overflow-y-auto">
        <table className="min-w-full text-sm">
          <tbody>
            <tr>
              <td colSpan={11} className="p-0">
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((item) => {
                    const result = results[item.index];
                    return (
                      <div
                        key={result.id}
                        className="absolute left-0 top-0 grid w-full grid-cols-[repeat(11,minmax(0,1fr))] items-center border-b border-border px-4 py-3"
                        style={{ transform: `translateY(${item.start}px)`, height: `${item.size}px` }}
                      >
                        <div><StatusBadge status={result.status} /></div>
                        <div>{result.suiteName}</div>
                        <div>{result.testName}</div>
                        <div>{result.stepType ?? 'apiRequest'}</div>
                        <div className="font-mono text-xs">{result.method}</div>
                        <div className="truncate font-mono text-xs">{result.path}</div>
                        <div>{result.expectedStatus}</div>
                        <div>{result.actualStatus ?? '—'}</div>
                        <div>{result.attempts ?? 1}</div>
                        <div>{Format.duration(result.durationMs)}</div>
                        <div>
                          <Button variant="secondary" className="min-h-9 px-3" onClick={() => onSelect(result)}>
                            View
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHead() {
  return (
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
  );
}

function ResultRow({
  result,
  onSelect,
}: {
  result: TestResult;
  onSelect: (result: TestResult) => void;
}) {
  return (
    <tr>
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
  );
}
