interface StatCardProps {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <article className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </article>
  );
}
