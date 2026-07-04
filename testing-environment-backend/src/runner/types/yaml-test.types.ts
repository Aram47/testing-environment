export interface BackendTestFile {
  version?: string;
  run?: { timeout_minutes?: number; cleanup?: boolean };
  tests?: string[];
}

export interface TestSuiteFile {
  suite: string;
  tests: YamlTestCase[];
}

export type YamlTestCase = YamlRequestStep | YamlWaitStep | YamlPollStep;

export type YamlStepType = 'apiRequest' | 'wait' | 'pollUntil';

export type YamlAssertionOperator = 'equals' | 'contains' | 'exists';

export interface YamlAssertion {
  field_path: string;
  operator: YamlAssertionOperator;
  expected_value?: string;
}

export interface YamlRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  json?: unknown;
  expect?: {
    status?: number;
    json_contains?: unknown;
    assertions?: YamlAssertion[];
  };
  save?: Record<string, string>;
}

export interface YamlRequestStep {
  id?: string;
  type?: 'apiRequest';
  name: string;
  request: YamlRequest;
}

export interface YamlWaitStep {
  id?: string;
  type?: 'wait';
  name: string;
  wait: {
    duration_ms: number;
  };
}

export interface YamlPollStep {
  id?: string;
  type?: 'pollUntil';
  name: string;
  poll: {
    request: YamlRequest;
    timeout_seconds: number;
    interval_seconds: number;
    failure_message?: string;
  };
}

export interface HttpExecutionResult {
  actualStatus?: number;
  responseBody?: unknown;
  durationMs: number;
  errorMessage?: string;
}
