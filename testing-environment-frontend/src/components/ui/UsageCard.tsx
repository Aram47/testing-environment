import { Format } from '../../lib/format';

interface UsageCardProps {
  label: string;
  current: number;
  max: number;
}

export function UsageCard({ label, current, max }: UsageCardProps) {
  const percent = Format.percent(current, max);

  return (
    <article className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">
        {current} <span className="text-sm font-medium text-muted">/ {max}</span>
      </p>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
    </article>
  );
}
