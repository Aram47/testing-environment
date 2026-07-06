import { CopyButton } from '../../components/ui/CopyButton';
import { CodeBlock } from '../../editors/CodeBlock';
import type { TestRunDiagnosis, TestResult } from '../../types';

export function FailureInspector({
  diagnosis,
  result,
  onDownloadResponse,
}: {
  diagnosis: TestRunDiagnosis;
  result: TestResult | null;
  onDownloadResponse?: (artifactId: string) => void;
}) {
  const failure = diagnosis.primaryFailure;
  if (!failure) {
    return null;
  }

  const responsePreview = result?.responsePreview ?? result?.responseBody;
  const focusTime = result?.createdAt;

  return (
    <section className="rounded-lg border border-red-200 bg-red-50/40 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Primary failure</h2>
          <p className="mt-1 text-sm text-red-800">{failure.message}</p>
          <p className="mt-1 text-xs text-muted">
            {failure.kind} · phase {failure.phase}
            {failure.suiteName ? ` · ${failure.suiteName}` : ''}
            {failure.testName ? ` / ${failure.testName}` : ''}
          </p>
        </div>
        {result ? (
          <CopyButton
            value={JSON.stringify(
              {
                failure,
                result: {
                  method: result.method,
                  path: result.path,
                  expectedStatus: result.expectedStatus,
                  actualStatus: result.actualStatus,
                },
              },
              null,
              2,
            )}
            label="Copy failure JSON"
          />
        ) : null}
      </div>

      {(failure.expected !== undefined || failure.actual !== undefined) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DetailCard title="Expected" value={failure.expected ?? result?.expectedStatus} />
          <DetailCard title="Actual" value={failure.actual ?? result?.actualStatus} />
        </div>
      )}

      {result ? (
        <>
          <MetadataGrid result={result} />
          <DetailSection title="Request body" value={result.requestBody} />
          <DetailSection title="Response preview" value={responsePreview} />
          {result.responseArtifactId && onDownloadResponse ? (
            <button
              type="button"
              className="mt-2 text-sm font-medium text-brand underline"
              onClick={() => onDownloadResponse(result.responseArtifactId ?? '')}
            >
              Download full response body
            </button>
          ) : null}
        </>
      ) : null}

      <AssertionsList assertions={failure.assertions ?? result?.assertionResults} />
      <DetailSection title="Variables at failure" value={result?.variablesSnapshot} />
      <InfrastructureBlock diagnosis={diagnosis} />
      {focusTime ? (
        <p className="mt-4 text-xs text-muted">
          Correlated logs window: ±30s around {new Date(focusTime).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}

function MetadataGrid({ result }: { result: TestResult }) {
  return (
    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
      <MetaItem label="Method" value={result.method} />
      <MetaItem label="Path" value={result.path} />
      <MetaItem label="Attempts" value={String(result.attempts ?? 1)} />
      <MetaItem label="Duration" value={`${result.durationMs ?? 0} ms`} />
    </dl>
  );
}

function AssertionsList({
  assertions,
}: {
  assertions?: Array<{
    fieldPath: string;
    operator: string;
    expected?: unknown;
    actual?: unknown;
    passed: boolean;
    message?: string | null;
  }>;
}) {
  if (!assertions?.length) {
    return null;
  }

  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-ink">Assertions</h3>
      <ul className="mt-2 space-y-2">
        {assertions.map((assertion) => (
          <li
            key={`${assertion.fieldPath}-${assertion.operator}`}
            className={`rounded-md border p-3 text-sm ${assertion.passed ? 'border-emerald-200 bg-white' : 'border-red-200 bg-white'}`}
          >
            <div className="font-medium text-ink">
              {assertion.fieldPath} · {assertion.operator}
            </div>
            {assertion.message ? <p className="mt-1 text-red-700">{assertion.message}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function InfrastructureBlock({ diagnosis }: { diagnosis: TestRunDiagnosis }) {
  const { infrastructure } = diagnosis;
  if (!infrastructure.cleanupError && !infrastructure.errorMessage) {
    return null;
  }

  return (
    <section className="mt-5 rounded-md border border-border bg-white p-4 text-sm">
      <h3 className="font-semibold text-ink">Infrastructure diagnostics</h3>
      {infrastructure.errorMessage ? (
        <p className="mt-2 text-red-700">{infrastructure.errorMessage}</p>
      ) : null}
      {infrastructure.cleanupError ? (
        <p className="mt-2 text-amber-800">Cleanup: {infrastructure.cleanupError}</p>
      ) : null}
    </section>
  );
}

function DetailSection({ title, value }: { title: string; value: unknown }) {
  if (value === undefined || value === null) {
    return null;
  }
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <CodeBlock value={value} />
    </section>
  );
}

function DetailCard({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <h3 className="text-xs font-semibold uppercase text-muted">{title}</h3>
      <CodeBlock value={value} />
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
