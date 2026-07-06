export interface TestRunImageReference {
  serviceName: string;
  image: string;
}

export interface TestRunEnvironmentResult {
  status: 'passed' | 'failed' | 'skipped' | 'not_reached';
  validationPassed?: boolean;
  message?: string;
}

export interface TestRunHealthcheckResult {
  status: 'passed' | 'failed' | 'skipped' | 'not_reached';
  expectedStatus?: number;
  actualStatus?: number;
  durationMs?: number;
  url?: string;
  message?: string;
}

export interface TestRunExecutionMetadata {
  environmentResult?: TestRunEnvironmentResult;
  healthcheckResult?: TestRunHealthcheckResult;
  imageReferences?: TestRunImageReference[];
  usesDockerCompose?: boolean;
}

export interface StoredAssertionResult {
  fieldPath: string;
  operator: string;
  expected?: unknown;
  actual?: unknown;
  passed: boolean;
  message?: string;
}
