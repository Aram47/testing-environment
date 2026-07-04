import { TestRunStatus } from '@prisma/client';

export const TEST_RUN_PHASE_STATUSES: readonly TestRunStatus[] = [
  TestRunStatus.PREPARING_WORKSPACE,
  TestRunStatus.VALIDATING_ENVIRONMENT,
  TestRunStatus.PULLING_IMAGES,
  TestRunStatus.STARTING_ENVIRONMENT,
  TestRunStatus.WAITING_FOR_HEALTHCHECK,
  TestRunStatus.EXECUTING_TESTS,
  TestRunStatus.COLLECTING_ARTIFACTS,
  TestRunStatus.CLEANING_UP,
] as const;

export const TEST_RUN_TERMINAL_STATUSES: readonly TestRunStatus[] = [
  TestRunStatus.PASSED,
  TestRunStatus.TEST_FAILED,
  TestRunStatus.INFRA_FAILED,
  TestRunStatus.TIMED_OUT,
  TestRunStatus.CANCELLED,
] as const;

export const TEST_RUN_ACTIVE_STATUSES: readonly TestRunStatus[] = [
  TestRunStatus.CREATED,
  TestRunStatus.QUEUED,
  TestRunStatus.CLAIMED,
  ...TEST_RUN_PHASE_STATUSES,
  TestRunStatus.CANCEL_REQUESTED,
] as const;

export const TEST_RUN_CANCELLABLE_STATUSES: readonly TestRunStatus[] = [
  TestRunStatus.QUEUED,
  TestRunStatus.CLAIMED,
  ...TEST_RUN_PHASE_STATUSES,
] as const;

export function isTerminalTestRunStatus(status: TestRunStatus): boolean {
  return TEST_RUN_TERMINAL_STATUSES.includes(status);
}

export function isPhaseTestRunStatus(status: TestRunStatus): boolean {
  return TEST_RUN_PHASE_STATUSES.includes(status);
}
