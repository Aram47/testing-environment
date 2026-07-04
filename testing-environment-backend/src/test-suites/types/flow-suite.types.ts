export interface FlowSuiteDefinition {
  version: '1.0' | '1.1';
  suiteName: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowPosition {
  x: number;
  y: number;
}

export type FlowNode =
  FlowApiNode | FlowWaitNode | FlowPollUntilNode | FlowSetVariableNode | FlowAssertNode;

export type FlowNodeType = 'apiRequest' | 'wait' | 'pollUntil' | 'setVariable' | 'assert';

export type FlowAssertionOperator = 'equals' | 'contains' | 'exists';

export interface FlowRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

export interface FlowAssertion {
  fieldPath: string;
  operator: FlowAssertionOperator;
  expectedValue?: string;
}

export interface FlowBaseNode {
  id: string;
  position: FlowPosition;
  name: string;
  type?: FlowNodeType;
  version?: string;
  timeoutMs?: number;
  retryPolicy?: FlowRetryPolicy;
  continueOnFailure?: boolean;
}

export interface FlowApiNode extends FlowBaseNode {
  type?: 'apiRequest';
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  jsonBody?: unknown;
  expectStatus?: number;
  jsonContains?: unknown;
  assertions?: FlowAssertion[];
  save?: Record<string, string>;
}

export interface FlowWaitNode extends FlowBaseNode {
  type: 'wait';
  durationMs: number;
}

export interface FlowPollUntilNode extends FlowBaseNode {
  type: 'pollUntil';
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  jsonBody?: unknown;
  expectStatus?: number;
  jsonContains?: unknown;
  assertions?: FlowAssertion[];
  save?: Record<string, string>;
  timeoutSeconds: number;
  intervalSeconds: number;
  failureMessage?: string;
}

export interface FlowSetVariableNode extends FlowBaseNode {
  type: 'setVariable';
  variableName: string;
  value?: string;
  fromStepId?: string;
  path?: string;
}

export interface FlowAssertNode extends FlowBaseNode {
  type: 'assert';
  sourceStepId?: string;
  fieldPath: string;
  operator: FlowAssertionOperator;
  expectedValue?: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface FlowCompileResult {
  yamlContent: string;
  testsCount: number;
  warnings: string[];
  executionPlan?: unknown;
}
