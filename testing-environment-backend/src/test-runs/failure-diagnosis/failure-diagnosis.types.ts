import {
  Prisma,
  RunnerLogSource,
  TestResult,
  TestRun,
  TestRunFailureCategory,
  TestRunStatus,
} from '@prisma/client';
import { TestRunExecutionMetadata } from '../types/test-run-execution-metadata.types';

export const FAILURE_DIAGNOSIS_CATEGORIES = [
  'compose_validation_failed',
  'image_pull_failed',
  'container_exited',
  'port_conflict',
  'healthcheck_timeout',
  'dns_network_failure',
  'http_timeout',
  'unexpected_status',
  'assertion_mismatch',
  'variable_extraction_failed',
  'cancelled',
  'cleanup_failed',
  'internal_runner_error',
] as const;

export type FailureDiagnosisCategory = (typeof FAILURE_DIAGNOSIS_CATEGORIES)[number];

export interface DiagnosisEvidenceRef {
  testResultId?: string;
  phaseId?: string;
  logChunkSequence?: number;
  field?: string;
}

export interface DiagnosisEvidence {
  type: 'test_result' | 'phase' | 'log_excerpt' | 'healthcheck' | 'environment' | 'run_field';
  label: string;
  detail: string;
  ref?: DiagnosisEvidenceRef;
}

export interface SuggestedAction {
  id: string;
  label: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RunDiagnosis {
  category: FailureDiagnosisCategory;
  title: string;
  summary: string;
  primaryEvidence: DiagnosisEvidence[];
  relatedEvidence: DiagnosisEvidence[];
  suggestedActions: SuggestedAction[];
  confidence: number;
}

export interface LogChunkPreview {
  sequence: number;
  source: RunnerLogSource;
  preview: string;
}

export type DiagnosisRun = Pick<
  TestRun,
  | 'status'
  | 'failureCategory'
  | 'statusReason'
  | 'errorMessage'
  | 'cleanupError'
  | 'runnerId'
  | 'cancellationReason'
  | 'currentPhase'
  | 'phaseTimestamps'
  | 'executionMetadata'
>;

export interface FailureDiagnosisContext {
  run: DiagnosisRun;
  results: TestResult[];
  metadata: TestRunExecutionMetadata;
  phaseTimestamps: Partial<Record<TestRunStatus, Date>>;
  logPreviews: LogChunkPreview[];
  failedResult?: TestResult;
  message: string;
}

export function isTerminalFailureStatus(status: TestRunStatus): boolean {
  return (
    status === TestRunStatus.TEST_FAILED ||
    status === TestRunStatus.INFRA_FAILED ||
    status === TestRunStatus.TIMED_OUT ||
    status === TestRunStatus.CANCELLED
  );
}

export function readExecutionMetadata(
  value: Prisma.JsonValue | null,
): TestRunExecutionMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as TestRunExecutionMetadata;
}

export function readPhaseTimestamps(
  value: Prisma.JsonValue | null,
): Partial<Record<TestRunStatus, Date>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([status, timestamp]) => [status as TestRunStatus, new Date(timestamp)]),
  );
}

export function failureCategoryLabel(category: TestRunFailureCategory): string {
  return category.replace(/_/g, ' ').toLowerCase();
}
