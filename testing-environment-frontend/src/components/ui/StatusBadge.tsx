import type { RunStatus } from '../../types';

const styles: Record<RunStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700 ring-slate-200',
  RUNNING: 'bg-blue-50 text-blue-700 ring-blue-200',
  PASSED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-red-50 text-red-700 ring-red-200',
  CANCELLED: 'bg-amber-50 text-amber-800 ring-amber-200',
};

export function StatusBadge({ status }: { status?: RunStatus }) {
  if (!status) {
    return <span className="text-sm text-muted">No runs</span>;
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>
      {status}
    </span>
  );
}
