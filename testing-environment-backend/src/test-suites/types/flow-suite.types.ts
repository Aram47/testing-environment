export interface FlowSuiteDefinition {
  version: '1.0';
  suiteName: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowPosition {
  x: number;
  y: number;
}

export type FlowNode = FlowApiNode | FlowWaitNode | FlowPollUntilNode;

export type FlowNodeType = 'apiRequest' | 'wait' | 'pollUntil';

export type FlowAssertionOperator = 'equals' | 'contains' | 'exists';

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

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface FlowCompileResult {
  yamlContent: string;
  testsCount: number;
  warnings: string[];
}
