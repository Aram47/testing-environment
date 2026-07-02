export interface FlowSuiteDefinition {
  version: '1.0';
  suiteName: string;
  nodes: FlowApiNode[];
  edges: FlowEdge[];
}

export interface FlowPosition {
  x: number;
  y: number;
}

export interface FlowApiNode {
  id: string;
  position: FlowPosition;
  name: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  jsonBody?: unknown;
  expectStatus?: number;
  jsonContains?: unknown;
  save?: Record<string, string>;
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
