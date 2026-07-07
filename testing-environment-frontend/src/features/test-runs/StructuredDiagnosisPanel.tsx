import type { StructuredRunDiagnosis } from '../../types';

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) {
    return 'High';
  }
  if (confidence >= 0.7) {
    return 'Medium';
  }
  return 'Low';
}

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ');
}

export function StructuredDiagnosisPanel({
  diagnosis,
  onSelectTestResult,
}: {
  diagnosis: StructuredRunDiagnosis;
  onSelectTestResult?: (testResultId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Structured diagnosis
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{diagnosis.title}</h2>
          <p className="mt-2 text-sm text-ink/90">{diagnosis.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium capitalize text-amber-900 ring-1 ring-amber-200">
            {formatCategory(diagnosis.category)}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-muted ring-1 ring-border">
            Confidence: {confidenceLabel(diagnosis.confidence)}
          </span>
        </div>
      </div>

      <EvidenceSection
        title="Primary evidence"
        items={diagnosis.primaryEvidence}
        onSelectTestResult={onSelectTestResult}
      />
      {diagnosis.relatedEvidence.length > 0 ? (
        <EvidenceSection
          title="Related evidence"
          items={diagnosis.relatedEvidence}
          onSelectTestResult={onSelectTestResult}
        />
      ) : null}

      {diagnosis.suggestedActions.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-ink">Suggested actions</h3>
          <ol className="mt-3 space-y-3">
            {diagnosis.suggestedActions.map((action, index) => (
              <li
                key={action.id}
                className="rounded-md border border-border bg-white px-4 py-3 text-sm"
              >
                <p className="font-medium text-ink">
                  {index + 1}. {action.label}
                  <span className="ml-2 text-xs font-normal uppercase text-muted">
                    {action.priority}
                  </span>
                </p>
                <p className="mt-1 text-muted">{action.description}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function EvidenceSection({
  title,
  items,
  onSelectTestResult,
}: {
  title: string;
  items: StructuredRunDiagnosis['primaryEvidence'];
  onSelectTestResult?: (testResultId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => {
          const testResultId = item.ref?.testResultId;
          const content = (
            <>
              <p className="font-medium text-ink">{item.label}</p>
              <p className="mt-1 text-sm text-muted">{item.detail}</p>
            </>
          );

          return (
            <li
              key={`${item.label}-${index}`}
              className="rounded-md border border-border bg-white px-4 py-3 text-sm"
            >
              {testResultId && onSelectTestResult ? (
                <button
                  type="button"
                  className="w-full text-left hover:text-brand"
                  onClick={() => onSelectTestResult(testResultId)}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
