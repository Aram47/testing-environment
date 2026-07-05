import { FlowSuiteDefinition } from './flow-suite.types';

export type ApiImportSourceType = 'OPENAPI' | 'POSTMAN' | 'BRUNO' | 'CURL' | 'MANUAL';

export type ApiImportTemplate =
  'SMOKE_TEST' | 'AUTHENTICATED_JOURNEY' | 'CRUD_LIFECYCLE' | 'ASYNC_POLLING' | 'READINESS_TEST';

export type ImportedAuthType = 'BEARER' | 'API_KEY' | 'BASIC' | 'OAUTH';

export interface ImportedResponse {
  status: string;
  description?: string;
  body?: unknown;
}

export interface DetectedAuthScheme {
  type: ImportedAuthType;
  name: string;
  location?: 'header' | 'query' | 'cookie' | 'body' | 'metadata';
  parameterName?: string;
  secretKey?: string;
  metadata?: unknown;
}

export interface ImportWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  operationId?: string;
  message: string;
  metadata?: unknown;
}

export interface ImportedApiOperation {
  id: string;
  name: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
  expectedResponses?: ImportedResponse[];
  sourceMetadata: unknown;
}

export interface ManualImportRequest {
  name?: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  expectedStatus?: number;
}

export interface ImportParseInput {
  sourceType: ApiImportSourceType;
  content?: string;
  files?: Record<string, string>;
  manualRequest?: ManualImportRequest;
}

export interface ImportParseResult {
  operations: ImportedApiOperation[];
  authSchemes: DetectedAuthScheme[];
  warnings: ImportWarning[];
}

export interface ImportPreviewResult extends ImportParseResult {
  templates: ApiImportTemplate[];
  suggestedSecrets: string[];
}

export interface ImportGenerateResult {
  visualFlow: FlowSuiteDefinition;
  yamlContent: string;
  testsCount: number;
  warnings: ImportWarning[];
  suggestedSecrets: string[];
}
