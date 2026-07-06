import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { EnvironmentPreflightResult, PreflightCheck } from '../../api/environment-configs.api';

function StatusIcon({ status }: { status: PreflightCheck['status'] }) {
  if (status === 'pass') {
    return <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />;
  }
  if (status === 'warn') {
    return <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />;
  }
  return <XCircle size={16} className="text-red-600" aria-hidden="true" />;
}

export function PreflightPanel({
  result,
  isLoading,
}: {
  result?: EnvironmentPreflightResult;
  isLoading?: boolean;
}) {
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result && liveRef.current) {
      liveRef.current.textContent = result.ok
        ? 'Preflight passed'
        : 'Preflight found blocking issues';
    }
  }, [result]);

  if (isLoading) {
    return <section className="panel p-4 text-sm text-muted">Running preflight checks...</section>;
  }

  if (!result) {
    return null;
  }

  return (
    <section className="panel space-y-4 p-4" aria-labelledby="preflight-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="preflight-title" className="text-sm font-semibold text-ink">
          Preflight
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
            result.ok ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
          }`}
        >
          {result.ok ? 'Ready' : 'Blocked'}
        </span>
      </div>
      <div ref={liveRef} className="sr-only" aria-live="polite" />
      <ul className="space-y-2">
        {result.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm text-ink">
            <StatusIcon status={check.status} />
            <span>{check.message}</span>
          </li>
        ))}
      </ul>
      {result.dependencyWarnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Info size={16} /> Dependency warnings
          </div>
          {result.dependencyWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {result.securityErrors.length > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <XCircle size={16} /> Security errors
          </div>
          {result.securityErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      <div className="rounded-md border border-border bg-page p-3 text-sm">
        <div className="font-semibold text-ink">Resource estimation: {result.resourceEstimation.tier}</div>
        <div className="text-muted">{result.resourceEstimation.serviceCount} service(s)</div>
        <ul className="mt-2 list-disc pl-5 text-muted">
          {result.resourceEstimation.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
