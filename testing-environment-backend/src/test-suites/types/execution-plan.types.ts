export const EXECUTION_PLAN_SCHEMA_VERSION = 'execution-plan/v1';
export const CURRENT_VISUAL_DSL_VERSION = '1.1';

export type TestSuiteSourceMode = 'VISUAL' | 'RAW_YAML';

export type ExecutionStepType =
  'sequence' | 'apiRequest' | 'wait' | 'pollUntil' | 'setVariable' | 'assert';

export type AssertionOperator = 'equals' | 'contains' | 'exists';

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

export interface VariableDefinition {
  name: string;
  sourceStepId: string;
  path: string;
}

export interface ExecutionPlan {
  schemaVersion: typeof EXECUTION_PLAN_SCHEMA_VERSION;
  suiteRevisionId: string;
  suiteName: string;
  steps: ExecutionStep[];
  dependencies: Record<string, string[]>;
  variables: VariableDefinition[];
  timeoutMs: number;
}

export type ExecutionStep =
  | SequenceExecutionStep
  | ApiRequestExecutionStep
  | WaitExecutionStep
  | PollUntilExecutionStep
  | SetVariableExecutionStep
  | AssertExecutionStep;

export interface ExecutionStepBase<TType extends ExecutionStepType, TConfig> {
  id: string;
  type: TType;
  version: string;
  name: string;
  config: TConfig;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  continueOnFailure: boolean;
}

export interface SequenceStepConfig {
  stepIds: string[];
}

export type SequenceExecutionStep = ExecutionStepBase<'sequence', SequenceStepConfig>;

export interface ApiRequestStepConfig {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  json?: unknown;
  expect?: RequestExpectation;
  save?: Record<string, string>;
}

export type ApiRequestExecutionStep = ExecutionStepBase<'apiRequest', ApiRequestStepConfig>;

export interface WaitStepConfig {
  durationMs: number;
}

export type WaitExecutionStep = ExecutionStepBase<'wait', WaitStepConfig>;

export interface PollUntilStepConfig {
  request: ApiRequestStepConfig;
  timeoutMs: number;
  intervalMs: number;
  failureMessage?: string;
}

export type PollUntilExecutionStep = ExecutionStepBase<'pollUntil', PollUntilStepConfig>;

export interface SetVariableStepConfig {
  name: string;
  value?: string;
  fromStepId?: string;
  path?: string;
}

export type SetVariableExecutionStep = ExecutionStepBase<'setVariable', SetVariableStepConfig>;

export interface AssertStepConfig {
  sourceStepId?: string;
  fieldPath: string;
  operator: AssertionOperator;
  expectedValue?: string;
}

export type AssertExecutionStep = ExecutionStepBase<'assert', AssertStepConfig>;

export interface RequestExpectation {
  status?: number;
  jsonContains?: unknown;
  assertions?: ExecutionAssertion[];
}

export interface ExecutionAssertion {
  fieldPath: string;
  operator: AssertionOperator;
  expectedValue?: string;
}

export interface CompileExecutionPlanOptions {
  suiteRevisionId?: string;
  timeoutMs?: number;
}

export interface ExecutionPlanCompileResult {
  executionPlan: ExecutionPlan;
  yamlContent: string;
  testsCount: number;
  warnings: string[];
}
