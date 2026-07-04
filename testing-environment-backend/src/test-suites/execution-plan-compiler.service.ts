import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ApiRequestStepConfig,
  CompileExecutionPlanOptions,
  EXECUTION_PLAN_SCHEMA_VERSION,
  ExecutionAssertion,
  ExecutionPlan,
  ExecutionPlanCompileResult,
  ExecutionStep,
  VariableDefinition,
} from './types/execution-plan.types';
import {
  FlowApiNode,
  FlowAssertNode,
  FlowAssertion,
  FlowNode,
  FlowPollUntilNode,
  FlowSetVariableNode,
  FlowSuiteDefinition,
  FlowWaitNode,
} from './types/flow-suite.types';
import { VisualDslMigratorService } from './visual-dsl-migrator.service';
import { YamlSuiteAdapterService } from './yaml-suite-adapter.service';

const DEFAULT_PLAN_TIMEOUT_MS = 300000;
const DEFAULT_STEP_TIMEOUT_MS = 30000;

@Injectable()
export class ExecutionPlanCompilerService {
  constructor(
    private readonly migrator: VisualDslMigratorService,
    private readonly yamlAdapter: YamlSuiteAdapterService,
  ) {}

  compileVisual(
    flow: FlowSuiteDefinition,
    options: CompileExecutionPlanOptions = {},
  ): ExecutionPlanCompileResult {
    const migrated = this.migrator.migrate(flow);
    this.validateFlow(migrated);
    const orderedNodes = this.sortNodes(migrated.nodes, migrated.edges);
    const dependencies = this.toDependencyRecord(orderedNodes, migrated.edges);
    const steps = orderedNodes.map((node) => this.toExecutionStep(node));
    const executionPlan = this.yamlAdapter.normalizePlan({
      schemaVersion: EXECUTION_PLAN_SCHEMA_VERSION,
      suiteRevisionId: options.suiteRevisionId ?? 'draft',
      suiteName: migrated.suiteName.trim(),
      steps,
      dependencies,
      variables: this.collectVariables(steps),
      timeoutMs: options.timeoutMs ?? DEFAULT_PLAN_TIMEOUT_MS,
    });
    const yamlContent = this.yamlAdapter.exportYaml(executionPlan);

    return {
      executionPlan,
      yamlContent,
      testsCount: steps.filter((step) => step.type !== 'sequence').length,
      warnings: this.buildWarnings(steps),
    };
  }

  compileRawYaml(
    yamlContent: string,
    options: CompileExecutionPlanOptions = {},
  ): ExecutionPlanCompileResult {
    const executionPlan = this.yamlAdapter.importRawYaml(yamlContent, options);
    const exportedYaml = this.yamlAdapter.exportYaml(executionPlan);
    return {
      executionPlan,
      yamlContent: exportedYaml,
      testsCount: executionPlan.steps.filter((step) => step.type !== 'sequence').length,
      warnings: this.buildWarnings(executionPlan.steps),
    };
  }

  exportYaml(plan: ExecutionPlan): string {
    return this.yamlAdapter.exportYaml(plan);
  }

  private validateFlow(flow: FlowSuiteDefinition): void {
    if (!flow.suiteName?.trim()) {
      throw new BadRequestException('Suite name is required');
    }
    if (!Array.isArray(flow.nodes) || flow.nodes.length === 0) {
      throw new BadRequestException('At least one test step is required');
    }
    if (!Array.isArray(flow.edges)) {
      throw new BadRequestException('Flow edges must be an array');
    }

    const ids = new Set<string>();
    for (const node of flow.nodes) {
      if (!node.id?.trim()) {
        throw new BadRequestException('Every flow step must have an id');
      }
      if (ids.has(node.id)) {
        throw new BadRequestException(`Duplicate flow step id: ${node.id}`);
      }
      ids.add(node.id);
      if (!node.name?.trim()) {
        throw new BadRequestException(`Step ${node.id} is missing a name`);
      }
      if (!this.isSupportedNode(node)) {
        throw new BadRequestException(`Unsupported flow node type: ${node.type ?? 'unknown'}`);
      }
      this.validateNodeConfig(node);
    }

    const incomingCount = new Map(flow.nodes.map((node) => [node.id, 0]));
    const outgoingCount = new Map(flow.nodes.map((node) => [node.id, 0]));
    for (const edge of flow.edges) {
      if (!ids.has(edge.source) || !ids.has(edge.target)) {
        throw new BadRequestException('Flow contains an edge connected to a missing node');
      }
      incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
      outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1);
    }

    const hasBranching = [...incomingCount.values(), ...outgoingCount.values()].some(
      (count) => count > 1,
    );
    if (hasBranching) {
      throw new BadRequestException('Branching flows are not supported yet');
    }
  }

  private validateNodeConfig(node: FlowNode): void {
    if (this.isWaitNode(node)) {
      if (!Number.isFinite(node.durationMs) || node.durationMs <= 0) {
        throw new BadRequestException(
          `Wait step "${node.name}" needs a duration greater than 0 ms`,
        );
      }
      return;
    }
    if (this.isSetVariableNode(node)) {
      if (!node.variableName?.trim()) {
        throw new BadRequestException(`Set variable step "${node.name}" needs a variable name`);
      }
      return;
    }
    if (this.isAssertNode(node)) {
      if (!node.fieldPath?.trim()) {
        throw new BadRequestException(`Assert step "${node.name}" needs a response field path`);
      }
      return;
    }
    if (this.isPollNode(node)) {
      this.validateRequestNode(node);
      if (!Number.isFinite(node.timeoutSeconds) || node.timeoutSeconds <= 0) {
        throw new BadRequestException(
          `Poll step "${node.name}" needs a timeout greater than 0 seconds`,
        );
      }
      if (!Number.isFinite(node.intervalSeconds) || node.intervalSeconds <= 0) {
        throw new BadRequestException(
          `Poll step "${node.name}" needs a retry interval greater than 0 seconds`,
        );
      }
      if (node.intervalSeconds > node.timeoutSeconds) {
        throw new BadRequestException(
          `Poll step "${node.name}" interval cannot be greater than timeout`,
        );
      }
      return;
    }
    this.validateRequestNode(node);
  }

  private validateRequestNode(node: FlowApiNode | FlowPollUntilNode): void {
    if (!node.method?.trim()) {
      throw new BadRequestException(`API step "${node.name}" is missing a method`);
    }
    if (!node.path?.trim()) {
      throw new BadRequestException(`API step "${node.name}" is missing a path`);
    }
    for (const assertion of node.assertions ?? []) {
      if (!assertion.fieldPath?.trim()) {
        throw new BadRequestException(`Assertion in "${node.name}" needs a response field path`);
      }
      if (!assertion.operator) {
        throw new BadRequestException(`Assertion in "${node.name}" needs an operator`);
      }
    }
  }

  private sortNodes(
    nodes: FlowNode[],
    edges: Array<{ source: string; target: string }>,
  ): FlowNode[] {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const incomingCount = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

    for (const edge of edges) {
      incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
      outgoing.get(edge.source)?.push(edge.target);
    }

    const queue = nodes
      .filter((node) => incomingCount.get(node.id) === 0)
      .sort((left, right) => left.id.localeCompare(right.id));
    const ordered: FlowNode[] = [];

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) {
        continue;
      }
      ordered.push(node);
      for (const targetId of [...(outgoing.get(node.id) ?? [])].sort()) {
        const nextCount = (incomingCount.get(targetId) ?? 0) - 1;
        incomingCount.set(targetId, nextCount);
        if (nextCount === 0) {
          const target = nodeMap.get(targetId);
          if (target) {
            queue.push(target);
            queue.sort((left, right) => left.id.localeCompare(right.id));
          }
        }
      }
    }

    if (ordered.length !== nodes.length) {
      throw new BadRequestException('Flow contains a cycle');
    }
    return ordered;
  }

  private toDependencyRecord(
    nodes: FlowNode[],
    edges: Array<{ source: string; target: string }>,
  ): Record<string, string[]> {
    const dependencies = Object.fromEntries(nodes.map((node) => [node.id, [] as string[]]));
    for (const edge of edges) {
      dependencies[edge.target] = [...(dependencies[edge.target] ?? []), edge.source].sort();
    }
    return dependencies;
  }

  private toExecutionStep(node: FlowNode): ExecutionStep {
    const base = {
      id: node.id,
      name: node.name.trim(),
      timeoutMs: node.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
      retryPolicy: node.retryPolicy ?? { maxAttempts: 1, backoffMs: 0 },
      continueOnFailure: node.continueOnFailure === true,
    };

    if (this.isWaitNode(node)) {
      return {
        ...base,
        type: 'wait',
        version: node.version ?? 'wait/v1',
        config: { durationMs: node.durationMs },
      };
    }
    if (this.isPollNode(node)) {
      const timeoutMs = node.timeoutSeconds * 1000;
      return {
        ...base,
        type: 'pollUntil',
        version: node.version ?? 'pollUntil/v1',
        timeoutMs,
        config: {
          request: this.toRequestConfig(node),
          timeoutMs,
          intervalMs: node.intervalSeconds * 1000,
          ...(node.failureMessage?.trim() ? { failureMessage: node.failureMessage.trim() } : {}),
        },
      };
    }
    if (this.isSetVariableNode(node)) {
      return {
        ...base,
        type: 'setVariable',
        version: node.version ?? 'setVariable/v1',
        config: {
          name: node.variableName.trim(),
          ...(node.value !== undefined ? { value: node.value } : {}),
          ...(node.fromStepId?.trim() ? { fromStepId: node.fromStepId.trim() } : {}),
          ...(node.path?.trim() ? { path: node.path.trim() } : {}),
        },
      };
    }
    if (this.isAssertNode(node)) {
      return {
        ...base,
        type: 'assert',
        version: node.version ?? 'assert/v1',
        config: {
          ...(node.sourceStepId?.trim() ? { sourceStepId: node.sourceStepId.trim() } : {}),
          fieldPath: node.fieldPath.trim(),
          operator: node.operator,
          ...(node.expectedValue !== undefined && node.expectedValue !== ''
            ? { expectedValue: node.expectedValue }
            : {}),
        },
      };
    }
    return {
      ...base,
      type: 'apiRequest',
      version: node.version ?? 'apiRequest/v1',
      config: this.toRequestConfig(node),
    };
  }

  private toRequestConfig(node: FlowApiNode | FlowPollUntilNode): ApiRequestStepConfig {
    return this.cleanObject({
      method: node.method.trim().toUpperCase(),
      path: node.path.trim(),
      headers: this.cleanObject(node.headers),
      query: this.cleanObject(node.query),
      json: node.jsonBody,
      expect: this.cleanObject({
        status: node.expectStatus ?? 200,
        jsonContains: node.jsonContains,
        assertions: this.toAssertions(node.assertions),
      }),
      save: this.cleanObject(node.save),
    }) as ApiRequestStepConfig;
  }

  private toAssertions(assertions: FlowAssertion[] | undefined): ExecutionAssertion[] | undefined {
    const entries = (assertions ?? [])
      .filter((assertion) => assertion.fieldPath?.trim() && assertion.operator)
      .map((assertion) => ({
        fieldPath: assertion.fieldPath.trim(),
        operator: assertion.operator,
        ...(assertion.expectedValue !== undefined && assertion.expectedValue !== ''
          ? { expectedValue: assertion.expectedValue }
          : {}),
      }));
    return entries.length > 0 ? entries : undefined;
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
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private buildWarnings(steps: ExecutionStep[]): string[] {
    const warnings: string[] = [];
    const savedBy = new Map<string, string>();
    for (const variable of this.collectVariables(steps)) {
      const owner = savedBy.get(variable.name);
      if (owner) {
        warnings.push(
          `Variable "${variable.name}" is saved by both "${owner}" and "${variable.sourceStepId}".`,
        );
      }
      savedBy.set(variable.name, variable.sourceStepId);
    }
    return warnings;
  }

  private cleanObject<T extends Record<string, unknown>>(record: T | undefined): T | undefined {
    if (!record || typeof record !== 'object') {
      return undefined;
    }
    const entries = Object.entries(record).filter(([, value]) => {
      if (value === undefined || value === '') {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return true;
    });
    return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
  }

  private isSupportedNode(node: FlowNode): boolean {
    return ['apiRequest', 'wait', 'pollUntil', 'setVariable', 'assert'].includes(
      node.type ?? 'apiRequest',
    );
  }

  private isWaitNode(node: FlowNode): node is FlowWaitNode {
    return node.type === 'wait';
  }

  private isPollNode(node: FlowNode): node is FlowPollUntilNode {
    return node.type === 'pollUntil';
  }

  private isSetVariableNode(node: FlowNode): node is FlowSetVariableNode {
    return node.type === 'setVariable';
  }

  private isAssertNode(node: FlowNode): node is FlowAssertNode {
    return node.type === 'assert';
  }
}
