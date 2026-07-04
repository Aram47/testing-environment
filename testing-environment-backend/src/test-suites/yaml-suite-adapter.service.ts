import { BadRequestException, Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import {
  ApiRequestStepConfig,
  CompileExecutionPlanOptions,
  EXECUTION_PLAN_SCHEMA_VERSION,
  ExecutionAssertion,
  ExecutionPlan,
  ExecutionStep,
  RequestExpectation,
  RetryPolicy,
  VariableDefinition,
} from './types/execution-plan.types';

interface RawSuiteFile {
  suite: string;
  tests: RawYamlStep[];
  timeout_ms?: number;
}

type RawYamlStep =
  | RawYamlRequestStep
  | RawYamlWaitStep
  | RawYamlPollStep
  | RawYamlSetVariableStep
  | RawYamlAssertStep;

interface RawYamlBaseStep {
  id?: string;
  type?: string;
  name: string;
  timeout_ms?: number;
  retry_policy?: RawRetryPolicy;
  continue_on_failure?: boolean;
}

interface RawRetryPolicy {
  max_attempts?: number;
  backoff_ms?: number;
}

interface RawYamlRequestStep extends RawYamlBaseStep {
  type?: 'apiRequest';
  request: RawYamlRequest;
}

interface RawYamlWaitStep extends RawYamlBaseStep {
  type?: 'wait';
  wait: {
    duration_ms: number;
  };
}

interface RawYamlPollStep extends RawYamlBaseStep {
  type?: 'pollUntil';
  poll: {
    request: RawYamlRequest;
    timeout_seconds?: number;
    timeout_ms?: number;
    interval_seconds?: number;
    interval_ms?: number;
    failure_message?: string;
  };
}

interface RawYamlSetVariableStep extends RawYamlBaseStep {
  type: 'setVariable';
  set_variable: {
    name: string;
    value?: string;
    from_step_id?: string;
    path?: string;
  };
}

interface RawYamlAssertStep extends RawYamlBaseStep {
  type: 'assert';
  assert: {
    source_step_id?: string;
    field_path: string;
    operator: 'equals' | 'contains' | 'exists';
    expected_value?: string;
  };
}

interface RawYamlRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  json?: unknown;
  expect?: {
    status?: number;
    json_contains?: unknown;
    assertions?: RawYamlAssertion[];
  };
  save?: Record<string, string>;
}

interface RawYamlAssertion {
  field_path: string;
  operator: 'equals' | 'contains' | 'exists';
  expected_value?: string;
}

const DEFAULT_PLAN_TIMEOUT_MS = 300000;
const DEFAULT_STEP_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 1, backoffMs: 0 };

@Injectable()
export class YamlSuiteAdapterService {
  importRawYaml(content: string, options: CompileExecutionPlanOptions = {}): ExecutionPlan {
    const parsed = yaml.load(content) as RawSuiteFile;
    if (!parsed || typeof parsed !== 'object' || !parsed.suite || !Array.isArray(parsed.tests)) {
      throw new BadRequestException('Invalid test suite YAML');
    }

    return this.fromRawSuite(parsed, options);
  }

  fromRawSuite(suite: RawSuiteFile, options: CompileExecutionPlanOptions = {}): ExecutionPlan {
    const steps = suite.tests.map((test, index) => this.toExecutionStep(test, index));
    const dependencies = this.toLinearDependencies(steps);
    const variables = this.collectVariables(steps);

    return this.normalizePlan({
      schemaVersion: EXECUTION_PLAN_SCHEMA_VERSION,
      suiteRevisionId: options.suiteRevisionId ?? 'draft',
      suiteName: suite.suite.trim(),
      steps,
      dependencies,
      variables,
      timeoutMs: options.timeoutMs ?? suite.timeout_ms ?? DEFAULT_PLAN_TIMEOUT_MS,
    });
  }

  exportYaml(plan: ExecutionPlan): string {
    const suite = {
      suite: plan.suiteName,
      tests: plan.steps
        .filter((step) => step.type !== 'sequence')
        .map((step) => this.toYamlStep(step)),
    };
    return yaml.dump(this.sortKeysDeep(suite), {
      noRefs: true,
      lineWidth: 120,
      sortKeys: false,
    });
  }

  normalizePlan(plan: ExecutionPlan): ExecutionPlan {
    const steps = plan.steps.map((step) => this.normalizeStep(step));
    return {
      schemaVersion: EXECUTION_PLAN_SCHEMA_VERSION,
      suiteRevisionId: plan.suiteRevisionId || 'draft',
      suiteName: plan.suiteName?.trim() || 'Unnamed suite',
      steps,
      dependencies: this.sortDependencyRecord(plan.dependencies),
      variables: [...plan.variables].sort((left, right) =>
        `${left.name}:${left.sourceStepId}:${left.path}`.localeCompare(
          `${right.name}:${right.sourceStepId}:${right.path}`,
        ),
      ),
      timeoutMs: this.positiveNumber(plan.timeoutMs, DEFAULT_PLAN_TIMEOUT_MS),
    };
  }

  private toExecutionStep(test: RawYamlStep, index: number): ExecutionStep {
    const id = this.stableStepId(test, index);
    const base = {
      id,
      name: test.name?.trim() || id,
      timeoutMs: this.positiveNumber(test.timeout_ms, DEFAULT_STEP_TIMEOUT_MS),
      retryPolicy: this.toRetryPolicy(test.retry_policy),
      continueOnFailure: test.continue_on_failure === true,
    };

    if (this.isWaitStep(test)) {
      if (!Number.isFinite(test.wait.duration_ms) || test.wait.duration_ms <= 0) {
        throw new BadRequestException(
          `Wait step "${base.name}" needs a duration greater than 0 ms`,
        );
      }
      return {
        ...base,
        type: 'wait',
        version: 'wait/v1',
        config: { durationMs: test.wait.duration_ms },
      };
    }

    if (this.isPollStep(test)) {
      const timeoutMs =
        test.poll.timeout_ms ??
        (test.poll.timeout_seconds === undefined ? undefined : test.poll.timeout_seconds * 1000);
      const intervalMs =
        test.poll.interval_ms ??
        (test.poll.interval_seconds === undefined ? undefined : test.poll.interval_seconds * 1000);
      const normalizedTimeoutMs = this.positiveNumber(timeoutMs, DEFAULT_STEP_TIMEOUT_MS);
      const normalizedIntervalMs = this.positiveNumber(intervalMs, 1000);
      if (normalizedIntervalMs > normalizedTimeoutMs) {
        throw new BadRequestException(
          `Poll step "${base.name}" interval cannot be greater than timeout`,
        );
      }
      return {
        ...base,
        type: 'pollUntil',
        version: 'pollUntil/v1',
        timeoutMs: normalizedTimeoutMs,
        config: {
          request: this.toRequestConfig(test.poll.request, base.name),
          timeoutMs: normalizedTimeoutMs,
          intervalMs: normalizedIntervalMs,
          ...(test.poll.failure_message?.trim()
            ? { failureMessage: test.poll.failure_message.trim() }
            : {}),
        },
      };
    }

    if (this.isSetVariableStep(test)) {
      if (!test.set_variable.name?.trim()) {
        throw new BadRequestException(`Set variable step "${base.name}" needs a variable name`);
      }
      return {
        ...base,
        type: 'setVariable',
        version: 'setVariable/v1',
        config: {
          name: test.set_variable.name.trim(),
          ...(test.set_variable.value !== undefined ? { value: test.set_variable.value } : {}),
          ...(test.set_variable.from_step_id?.trim()
            ? { fromStepId: test.set_variable.from_step_id.trim() }
            : {}),
          ...(test.set_variable.path?.trim() ? { path: test.set_variable.path.trim() } : {}),
        },
      };
    }

    if (this.isAssertStep(test)) {
      if (!test.assert.field_path?.trim()) {
        throw new BadRequestException(`Assert step "${base.name}" needs a response field path`);
      }
      return {
        ...base,
        type: 'assert',
        version: 'assert/v1',
        config: {
          ...(test.assert.source_step_id?.trim()
            ? { sourceStepId: test.assert.source_step_id.trim() }
            : {}),
          fieldPath: test.assert.field_path.trim(),
          operator: test.assert.operator,
          ...(test.assert.expected_value !== undefined && test.assert.expected_value !== ''
            ? { expectedValue: test.assert.expected_value }
            : {}),
        },
      };
    }

    if (!this.isRequestStep(test)) {
      throw new BadRequestException(
        `Unsupported test step type: ${(test as { type?: string }).type ?? 'unknown'}`,
      );
    }

    return {
      ...base,
      type: 'apiRequest',
      version: 'apiRequest/v1',
      config: this.toRequestConfig(test.request, base.name),
    };
  }

  private toRequestConfig(request: RawYamlRequest, stepName: string): ApiRequestStepConfig {
    if (!request?.method?.trim()) {
      throw new BadRequestException(`API step "${stepName}" is missing a method`);
    }
    if (!request.path?.trim()) {
      throw new BadRequestException(`API step "${stepName}" is missing a path`);
    }
    return this.cleanObject({
      method: request.method.trim().toUpperCase(),
      path: request.path.trim(),
      headers: this.cleanObject(request.headers),
      query: this.cleanObject(request.query),
      json: request.json,
      expect: this.toExpectation(request.expect),
      save: this.cleanObject(request.save),
    }) as ApiRequestStepConfig;
  }

  private toExpectation(expect: RawYamlRequest['expect']): RequestExpectation | undefined {
    return this.cleanObject({
      status: expect?.status ?? 200,
      jsonContains: expect?.json_contains,
      assertions: this.toAssertions(expect?.assertions),
    }) as RequestExpectation | undefined;
  }

  private toAssertions(
    assertions: RawYamlAssertion[] | undefined,
  ): ExecutionAssertion[] | undefined {
    const entries = (assertions ?? [])
      .filter((assertion) => assertion.field_path?.trim() && assertion.operator)
      .map((assertion) => ({
        fieldPath: assertion.field_path.trim(),
        operator: assertion.operator,
        ...(assertion.expected_value !== undefined && assertion.expected_value !== ''
          ? { expectedValue: assertion.expected_value }
          : {}),
      }));
    return entries.length > 0 ? entries : undefined;
  }

  private toYamlStep(step: ExecutionStep): Record<string, unknown> {
    const base = this.cleanObject({
      id: step.id,
      type: step.type,
      name: step.name,
      timeout_ms: step.timeoutMs,
      retry_policy: this.toRawRetryPolicy(step.retryPolicy),
      continue_on_failure: step.continueOnFailure ? true : undefined,
    }) as Record<string, unknown>;

    if (step.type === 'wait') {
      return this.cleanObject({
        ...base,
        wait: { duration_ms: step.config.durationMs },
      }) as Record<string, unknown>;
    }
    if (step.type === 'pollUntil') {
      return this.cleanObject({
        ...base,
        poll: {
          request: this.toYamlRequest(step.config.request),
          timeout_ms: step.config.timeoutMs,
          interval_ms: step.config.intervalMs,
          failure_message: step.config.failureMessage,
        },
      }) as Record<string, unknown>;
    }
    if (step.type === 'setVariable') {
      return this.cleanObject({
        ...base,
        set_variable: {
          name: step.config.name,
          value: step.config.value,
          from_step_id: step.config.fromStepId,
          path: step.config.path,
        },
      }) as Record<string, unknown>;
    }
    if (step.type === 'assert') {
      return this.cleanObject({
        ...base,
        assert: {
          source_step_id: step.config.sourceStepId,
          field_path: step.config.fieldPath,
          operator: step.config.operator,
          expected_value: step.config.expectedValue,
        },
      }) as Record<string, unknown>;
    }
    if (step.type === 'sequence') {
      return this.cleanObject({
        ...base,
        sequence: { step_ids: step.config.stepIds },
      }) as Record<string, unknown>;
    }
    return this.cleanObject({
      ...base,
      request: this.toYamlRequest(step.config),
    }) as Record<string, unknown>;
  }

  private toYamlRequest(request: ApiRequestStepConfig): Record<string, unknown> {
    return this.cleanObject({
      method: request.method,
      path: request.path,
      headers: this.cleanObject(request.headers),
      query: this.cleanObject(request.query),
      json: request.json,
      expect: this.cleanObject({
        status: request.expect?.status,
        json_contains: request.expect?.jsonContains,
        assertions: request.expect?.assertions?.map((assertion) =>
          this.cleanObject({
            field_path: assertion.fieldPath,
            operator: assertion.operator,
            expected_value: assertion.expectedValue,
          }),
        ),
      }),
      save: this.cleanObject(request.save),
    }) as Record<string, unknown>;
  }

  private normalizeStep(step: ExecutionStep): ExecutionStep {
    return {
      ...step,
      id: step.id.trim(),
      name: step.name.trim(),
      timeoutMs: this.positiveNumber(step.timeoutMs, DEFAULT_STEP_TIMEOUT_MS),
      retryPolicy: this.toRetryPolicy(step.retryPolicy),
      continueOnFailure: step.continueOnFailure === true,
    } as ExecutionStep;
  }

  private toLinearDependencies(steps: ExecutionStep[]): Record<string, string[]> {
    return Object.fromEntries(
      steps.map((step, index) => [step.id, index === 0 ? [] : [steps[index - 1].id]]),
    );
  }

  private collectVariables(steps: ExecutionStep[]): VariableDefinition[] {
    return steps
      .flatMap((step) => {
        if (step.type === 'apiRequest') {
          return Object.entries(step.config.save ?? {}).map(([name, path]) => ({
            name,
            sourceStepId: step.id,
            path,
          }));
        }
        if (step.type === 'pollUntil') {
          return Object.entries(step.config.request.save ?? {}).map(([name, path]) => ({
            name,
            sourceStepId: step.id,
            path,
          }));
        }
        if (step.type === 'setVariable') {
          return [{ name: step.config.name, sourceStepId: step.id, path: step.config.path ?? '$' }];
        }
        return [];
      })
      .filter((variable) => variable.name.trim())
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private stableStepId(test: RawYamlStep, index: number): string {
    return test.id?.trim() || `step-${String(index + 1).padStart(3, '0')}`;
  }

  private toRetryPolicy(policy: RawRetryPolicy | RetryPolicy | undefined): RetryPolicy {
    const rawPolicy = policy as Partial<RetryPolicy & RawRetryPolicy> | undefined;
    return {
      maxAttempts: this.positiveNumber(rawPolicy?.maxAttempts ?? rawPolicy?.max_attempts, 1),
      backoffMs: this.nonNegativeNumber(rawPolicy?.backoffMs ?? rawPolicy?.backoff_ms, 0),
    };
  }

  private toRawRetryPolicy(policy: RetryPolicy): RawRetryPolicy | undefined {
    if (policy.maxAttempts === DEFAULT_RETRY_POLICY.maxAttempts && policy.backoffMs === 0) {
      return undefined;
    }
    return { max_attempts: policy.maxAttempts, backoff_ms: policy.backoffMs };
  }

  private sortDependencyRecord(dependencies: Record<string, string[]>): Record<string, string[]> {
    return Object.fromEntries(
      Object.entries(dependencies)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, values]) => [key, [...values].sort()]),
    );
  }

  private sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortKeysDeep(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, this.sortKeysDeep(entryValue)]),
    );
  }

  private cleanObject<T extends Record<string, unknown>>(value: T | undefined): T | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const entries = Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === undefined || entryValue === '') {
        return false;
      }
      if (Array.isArray(entryValue)) {
        return entryValue.length > 0;
      }
      return true;
    });
    return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
  }

  private positiveNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private nonNegativeNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  private isWaitStep(test: RawYamlStep): test is RawYamlWaitStep {
    return 'wait' in test;
  }

  private isPollStep(test: RawYamlStep): test is RawYamlPollStep {
    return 'poll' in test;
  }

  private isRequestStep(test: RawYamlStep): test is RawYamlRequestStep {
    return 'request' in test;
  }

  private isSetVariableStep(test: RawYamlStep): test is RawYamlSetVariableStep {
    return test.type === 'setVariable' && 'set_variable' in test;
  }

  private isAssertStep(test: RawYamlStep): test is RawYamlAssertStep {
    return test.type === 'assert' && 'assert' in test;
  }
}
