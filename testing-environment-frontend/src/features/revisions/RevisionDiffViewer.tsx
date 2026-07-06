import type { RevisionLineDiff } from '../../types';

export function RevisionDiffViewer({
  title,
  composeDiff,
  runtimeDiff,
}: {
  title: string;
  composeDiff: RevisionLineDiff[];
  runtimeDiff: RevisionLineDiff[];
}) {
  const lines = [...composeDiff, ...runtimeDiff];
  if (lines.length === 0) {
    return (
      <div className="rounded-md border border-border bg-page p-3 text-sm text-muted">
        {title}: no line changes.
      </div>
    );
  }

  return (
    <section className="rounded-md border border-border bg-page p-3">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-muted">
              <th className="px-2 py-1">Line</th>
              <th className="px-2 py-1">From</th>
              <th className="px-2 py-1">To</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((entry) => (
              <tr key={`${entry.line}-${entry.from ?? ''}-${entry.to ?? ''}`} className="border-t border-border">
                <td className="px-2 py-1 font-mono text-muted">{entry.line}</td>
                <td className="px-2 py-1 font-mono text-red-700">{entry.from ?? ''}</td>
                <td className="px-2 py-1 font-mono text-emerald-700">{entry.to ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
