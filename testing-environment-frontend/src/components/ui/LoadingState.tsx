export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <section aria-busy="true" className="space-y-3 rounded-lg border border-border bg-white p-5">
      <p className="text-sm font-medium text-muted">{label}...</p>
      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded bg-slate-100" />
    </section>
  );
}
