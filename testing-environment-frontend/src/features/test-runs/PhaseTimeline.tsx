import { Format } from '../../lib/format';
import type { PhaseTimelineEntry } from '../../types';

const statusStyles: Record<PhaseTimelineEntry['status'], string> = {
  pending: 'border-slate-200 bg-slate-50 text-slate-500',
  active: 'border-blue-300 bg-blue-50 text-blue-800 ring-2 ring-blue-200',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  failed: 'border-red-300 bg-red-50 text-red-800 ring-2 ring-red-200',
  skipped: 'border-slate-200 bg-slate-100 text-slate-500',
};

export function PhaseTimeline({ phases }: { phases: PhaseTimelineEntry[] }) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-ink">Phase timeline</h2>
      <ol className="grid gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {phases.map((phase) => (
          <li
            key={phase.id}
            className={`rounded-md border p-3 text-sm ${statusStyles[phase.status]}`}
          >
            <div className="font-semibold">{phase.label}</div>
            <div className="mt-1 text-xs capitalize">{phase.status}</div>
            {phase.durationMs != null ? (
              <div className="mt-2 text-xs">{Format.duration(phase.durationMs)}</div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
