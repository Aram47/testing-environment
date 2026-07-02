export interface BackendTestFile {
  version?: string;
  run?: { timeout_minutes?: number; cleanup?: boolean };
  tests?: string[];
}

export interface TestSuiteFile {
  suite: string;
  tests: YamlTestCase[];
}

export interface YamlTestCase {
  name: string;
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, unknown>;
    json?: unknown;
    expect?: {
      status?: number;
      json_contains?: unknown;
    };
    save?: Record<string, string>;
  };
}

export interface HttpExecutionResult {
  actualStatus?: number;
  responseBody?: unknown;
  durationMs: number;
  errorMessage?: string;
}
