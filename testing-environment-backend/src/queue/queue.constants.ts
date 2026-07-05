export const TEST_RUN_QUEUE = 'test-runs';
export const TEST_RUN_JOB_NAME = 'execute-test-run';
export const SECRET_ROTATION_QUEUE = 'secret-key-rotations';
export const SECRET_ROTATION_JOB_NAME = 'rotate-secret-key';

export interface TestRunJobData {
  testRunId: string;
}

export interface SecretRotationJobData {
  rotationJobId: string;
}

export function getTestRunJobId(testRunId: string): string {
  return `test-run:${testRunId}`;
}

export function getSecretRotationJobId(rotationJobId: string): string {
  return `secret-rotation:${rotationJobId}`;
}
