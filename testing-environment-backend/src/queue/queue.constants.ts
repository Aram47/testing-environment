export const TEST_RUN_QUEUE = 'test-runs';
export const TEST_RUN_JOB_NAME = 'execute-test-run';

export interface TestRunJobData {
  testRunId: string;
}

export function getTestRunJobId(testRunId: string): string {
  return `test-run:${testRunId}`;
}
