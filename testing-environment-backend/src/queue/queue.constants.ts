export const TEST_RUN_QUEUE = 'test-runs';
export const TEST_RUN_JOB_NAME = 'execute-test-run';
export const SECRET_ROTATION_QUEUE = 'secret-key-rotations';
export const SECRET_ROTATION_JOB_NAME = 'rotate-secret-key';
export const ARTIFACT_RETENTION_QUEUE = 'artifact-retention-cleanup';
export const ARTIFACT_RETENTION_JOB_NAME = 'cleanup-expired-artifacts';

export interface TestRunJobData {
  testRunId: string;
  context?: Partial<TestRunJobContext>;
}

export interface SecretRotationJobData {
  rotationJobId: string;
}

export type ArtifactRetentionJobData = Record<string, never>;

export function getTestRunJobId(testRunId: string): string {
  return `test-run:${testRunId}`;
}

export function getSecretRotationJobId(rotationJobId: string): string {
  return `secret-rotation:${rotationJobId}`;
}
import { TestRunJobContext } from '../observability/execution-context.types';
