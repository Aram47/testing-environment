import { lazy, Suspense } from 'react';
import type { TestResult } from '../../types';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';

const JsonViewer = lazy(() =>
  import('../../editors/JsonViewer').then((module) => ({ default: module.JsonViewer })),
);

export function TestResultDetailsDrawer({
  result,
  onClose,
  onDownloadResponse,
}: {
  result: TestResult | null;
  onClose: () => void;
  onDownloadResponse: (artifactId: string) => void;
}) {
  if (!result) {
    return null;
  }
  const responsePreview = result.responsePreview ?? result.responseBody;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l border-border bg-white p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{result.testName}</h2>
          <p className="text-sm text-muted">{result.method} {result.path}</p>
          <p className="mt-1 text-xs text-muted">Type: {result.stepType ?? 'apiRequest'} · Attempts: {result.attempts ?? 1}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.responseArtifactId ? (
            <Button variant="secondary" onClick={() => onDownloadResponse(result.responseArtifactId ?? '')}>
              Download body
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
      <Detail title="Request body" value={result.requestBody} />
      <Detail title={result.responsePreviewTruncated ? 'Response body preview' : 'Response body'} value={responsePreview} />
      {result.responsePreviewTruncated ? (
        <p className="mt-2 text-xs text-muted">Full response body is stored as a downloadable artifact.</p>
      ) : null}
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
      <Suspense fallback={<LoadingState label="Loading JSON viewer" />}>
        <JsonViewer value={value} />
      </Suspense>
    </section>
  );
}
