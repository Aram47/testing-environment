import type { TestResult } from '../../types';
import { Button } from '../../components/ui/Button';

export function TestResultDetailsDrawer({ result, onClose }: { result: TestResult | null; onClose: () => void }) {
  if (!result) {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l border-border bg-white p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{result.testName}</h2>
          <p className="text-sm text-muted">{result.method} {result.path}</p>
          <p className="mt-1 text-xs text-muted">Type: {result.stepType ?? 'apiRequest'} · Attempts: {result.attempts ?? 1}</p>
        </div>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
      <Detail title="Request body" value={result.requestBody} />
      <Detail title="Response body" value={result.responseBody} />
      <Detail title="Request headers" value={result.requestHeaders} />
      <Detail title="Response headers" value={result.responseHeaders} />
      {result.errorMessage ? (
        <section className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.errorMessage}
        </section>
      ) : null}
    </aside>
  );
}

function Detail({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </section>
  );
}
