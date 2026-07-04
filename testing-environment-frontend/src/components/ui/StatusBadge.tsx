import type { RunStatus, TestResultStatus } from '../../types';

type BadgeStatus = RunStatus | TestResultStatus;

const styles: Record<BadgeStatus, string> = {
  CREATED: 'bg-slate-100 text-slate-700 ring-slate-200',
  QUEUED: 'bg-slate-100 text-slate-700 ring-slate-200',
  CLAIMED: 'bg-blue-50 text-blue-700 ring-blue-200',
  PREPARING_WORKSPACE: 'bg-blue-50 text-blue-700 ring-blue-200',
  VALIDATING_ENVIRONMENT: 'bg-blue-50 text-blue-700 ring-blue-200',
  PULLING_IMAGES: 'bg-blue-50 text-blue-700 ring-blue-200',
  STARTING_ENVIRONMENT: 'bg-blue-50 text-blue-700 ring-blue-200',
  WAITING_FOR_HEALTHCHECK: 'bg-blue-50 text-blue-700 ring-blue-200',
  EXECUTING_TESTS: 'bg-blue-50 text-blue-700 ring-blue-200',
  COLLECTING_ARTIFACTS: 'bg-blue-50 text-blue-700 ring-blue-200',
  CLEANING_UP: 'bg-blue-50 text-blue-700 ring-blue-200',
  PASSED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  TEST_FAILED: 'bg-red-50 text-red-700 ring-red-200',
  INFRA_FAILED: 'bg-red-50 text-red-700 ring-red-200',
  TIMED_OUT: 'bg-amber-50 text-amber-800 ring-amber-200',
  CANCEL_REQUESTED: 'bg-amber-50 text-amber-800 ring-amber-200',
  FAILED: 'bg-red-50 text-red-700 ring-red-200',
  CANCELLED: 'bg-amber-50 text-amber-800 ring-amber-200',
};

const labels: Record<BadgeStatus, string> = {
  CREATED: 'Created',
  QUEUED: 'Queued',
  CLAIMED: 'Claimed',
  PREPARING_WORKSPACE: 'Preparing',
  VALIDATING_ENVIRONMENT: 'Validating',
  PULLING_IMAGES: 'Pulling images',
  STARTING_ENVIRONMENT: 'Starting',
  WAITING_FOR_HEALTHCHECK: 'Healthcheck',
  EXECUTING_TESTS: 'Executing',
  COLLECTING_ARTIFACTS: 'Collecting',
  CLEANING_UP: 'Cleaning up',
  PASSED: 'Passed',
  TEST_FAILED: 'Test failed',
  INFRA_FAILED: 'Infra failed',
  TIMED_OUT: 'Timed out',
  CANCEL_REQUESTED: 'Cancelling',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: { status?: BadgeStatus }) {
  if (!status) {
    return <span className="text-sm text-muted">No runs</span>;
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
