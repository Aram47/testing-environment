import { Format } from '../../lib/format';
import type { PhaseTimelineEntry } from '../../types';

const phaseColors = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
];

export function PhaseDurationChart({ phases }: { phases: PhaseTimelineEntry[] }) {
  const measured = phases.filter((phase) => (phase.durationMs ?? 0) > 0);
  const total = measured.reduce((sum, phase) => sum + (phase.durationMs ?? 0), 0);

  if (!total) {
    return null;
  }

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-ink">Phase durations</h2>
      <div className="flex h-8 overflow-hidden rounded-md border border-border">
        {measured.map((phase, index) => {
          const width = ((phase.durationMs ?? 0) / total) * 100;
          return (
            <div
              key={phase.id}
              className={`${phaseColors[index % phaseColors.length]} relative min-w-[2px]`}
              style={{ width: `${width}%` }}
              title={`${phase.label}: ${Format.duration(phase.durationMs ?? undefined)}`}
            />
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        {measured.map((phase, index) => (
          <li key={phase.id} className="inline-flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${phaseColors[index % phaseColors.length]}`} />
            {phase.label} ({Format.duration(phase.durationMs ?? undefined)})
          </li>
        ))}
      </ul>
    </section>
  );
}
