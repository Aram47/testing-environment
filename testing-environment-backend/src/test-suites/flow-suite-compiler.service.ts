import { BadRequestException, Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import {
  FlowApiNode,
  FlowAssertion,
  FlowCompileResult,
  FlowEdge,
  FlowAssertNode,
  FlowNode,
  FlowPollUntilNode,
  FlowSetVariableNode,
  FlowSuiteDefinition,
  FlowWaitNode,
} from './types/flow-suite.types';

interface CompiledTestRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  json?: unknown;
  expect?: {
    status?: number;
    json_contains?: unknown;
    assertions?: CompiledAssertion[];
  };
  save?: Record<string, string>;
}

interface CompiledAssertion {
  field_path: string;
  operator: string;
  expected_value?: string;
}

type CompiledTestCase =
  | CompiledRequestTestCase
  | CompiledWaitTestCase
  | CompiledPollTestCase
  | CompiledSetVariableTestCase
  | CompiledAssertTestCase;

interface CompiledRequestTestCase {
  id: string;
  type: 'apiRequest';
  name: string;
  request: CompiledTestRequest;
}

interface CompiledWaitTestCase {
  id: string;
  type: 'wait';
  name: string;
  wait: {
    duration_ms: number;
  };
}

interface CompiledPollTestCase {
  id: string;
  type: 'pollUntil';
  name: string;
  poll: {
    request: CompiledTestRequest;
    timeout_seconds: number;
    interval_seconds: number;
    failure_message?: string;
  };
}

interface CompiledSetVariableTestCase {
  id: string;
  type: 'setVariable';
  name: string;
  set_variable: {
    name: string;
    value?: string;
    from_step_id?: string;
    path?: string;
  };
}

interface CompiledAssertTestCase {
  id: string;
  type: 'assert';
  name: string;
  assert: {
    source_step_id?: string;
    field_path: string;
    operator: string;
    expected_value?: string;
  };
}

@Injectable()
export class FlowSuiteCompilerService {
  compile(flow: FlowSuiteDefinition): FlowCompileResult {
    this.validateShape(flow);
    const nodes = flow.nodes.map((node) => this.normalizeNode(node));
    const orderedNodes = this.sortNodes(nodes, flow.edges);
    const warnings = this.buildWarnings(orderedNodes);
    const suite = {
      suite: flow.suiteName.trim(),
      tests: orderedNodes.map((node) => this.toTestCase(node)),
    };

    return {
      yamlContent: yaml.dump(suite, { noRefs: true, lineWidth: 120 }),
      testsCount: orderedNodes.length,
      warnings,
    };
  }

  private validateShape(flow: FlowSuiteDefinition): void {
    if (!flow || typeof flow !== 'object') {
      throw new BadRequestException('Flow definition is required');
    }
    if (flow.version !== '1.0') {
      throw new BadRequestException('Unsupported flow version');
    }
    if (!flow.suiteName?.trim()) {
      throw new BadRequestException('Suite name is required');
    }
    if (!Array.isArray(flow.nodes) || flow.nodes.length === 0) {
      throw new BadRequestException('At least one API node is required');
    }
    if (!Array.isArray(flow.edges)) {
      throw new BadRequestException('Flow edges must be an array');
    }

    const ids = new Set<string>();
    for (const rawNode of flow.nodes) {
      const node = this.normalizeNode(rawNode);
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

      if (this.isWaitNode(node)) {
        if (!Number.isFinite(node.durationMs) || node.durationMs <= 0) {
          throw new BadRequestException(
            `Wait step "${node.name}" needs a duration greater than 0 ms`,
          );
        }
        continue;
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
        continue;
      }

      if (this.isSetVariableNode(node)) {
        if (!node.variableName?.trim()) {
          throw new BadRequestException(`Set variable step "${node.name}" needs a variable name`);
        }
        continue;
      }

      if (this.isAssertNode(node)) {
        if (!node.fieldPath?.trim()) {
          throw new BadRequestException(`Assert step "${node.name}" needs a response field path`);
        }
        continue;
      }

      this.validateRequestNode(node);
    }
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

  private sortNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const incomingCount = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

    for (const edge of edges) {
      if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
        throw new BadRequestException('Flow contains an edge connected to a missing node');
      }
      incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
      outgoing.get(edge.source)?.push(edge.target);
    }

    const queue = nodes.filter((node) => incomingCount.get(node.id) === 0);
    const ordered: FlowNode[] = [];

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) {
        continue;
      }
      ordered.push(node);

      for (const targetId of outgoing.get(node.id) ?? []) {
        const nextCount = (incomingCount.get(targetId) ?? 0) - 1;
        incomingCount.set(targetId, nextCount);
        if (nextCount === 0) {
          const target = nodeMap.get(targetId);
          if (target) {
            queue.push(target);
          }
        }
      }
    }

    if (ordered.length !== nodes.length) {
      throw new BadRequestException('Flow contains a cycle');
    }

    return ordered;
  }

  private buildWarnings(nodes: FlowNode[]): string[] {
    const warnings: string[] = [];
    const savedBy = new Map<string, string>();

    for (const node of nodes) {
      if (this.isWaitNode(node) || this.isAssertNode(node)) {
        continue;
      }
      if (this.isSetVariableNode(node)) {
        const owner = savedBy.get(node.variableName);
        if (owner) {
          warnings.push(
            `Variable "${node.variableName}" is saved by both "${owner}" and "${node.name}".`,
          );
        }
        savedBy.set(node.variableName, node.name);
        continue;
      }
      for (const key of Object.keys(node.save ?? {}).filter(Boolean)) {
        const owner = savedBy.get(key);
        if (owner) {
          warnings.push(`Variable "${key}" is saved by both "${owner}" and "${node.name}".`);
        }
        savedBy.set(key, node.name);
      }
    }

    return warnings;
  }

  private toTestCase(node: FlowNode): CompiledTestCase {
    if (this.isWaitNode(node)) {
      return {
        id: node.id,
        type: 'wait',
        name: node.name,
        wait: { duration_ms: node.durationMs },
      };
    }

    if (this.isPollNode(node)) {
      return {
        id: node.id,
        type: 'pollUntil',
        name: node.name,
        poll: {
          request: this.toRequest(node),
          timeout_seconds: node.timeoutSeconds,
          interval_seconds: node.intervalSeconds,
          ...(node.failureMessage?.trim() ? { failure_message: node.failureMessage.trim() } : {}),
        },
      };
    }

    if (this.isSetVariableNode(node)) {
      return {
        id: node.id,
        type: 'setVariable',
        name: node.name,
        set_variable: {
          name: node.variableName,
          ...(node.value !== undefined ? { value: node.value } : {}),
          ...(node.fromStepId?.trim() ? { from_step_id: node.fromStepId.trim() } : {}),
          ...(node.path?.trim() ? { path: node.path.trim() } : {}),
        },
      };
    }

    if (this.isAssertNode(node)) {
      return {
        id: node.id,
        type: 'assert',
        name: node.name,
        assert: {
          ...(node.sourceStepId?.trim() ? { source_step_id: node.sourceStepId.trim() } : {}),
          field_path: node.fieldPath,
          operator: node.operator,
          ...(node.expectedValue !== undefined && node.expectedValue !== ''
            ? { expected_value: node.expectedValue }
            : {}),
        },
      };
    }

    return {
      id: node.id,
      type: 'apiRequest',
      name: node.name,
      request: this.toRequest(node),
    };
  }

  private toRequest(node: FlowApiNode | FlowPollUntilNode): CompiledTestRequest {
    const request: CompiledTestRequest = {
      method: node.method.toUpperCase(),
      path: node.path,
    };

    this.assignIfPresent(request, 'headers', this.cleanRecord(node.headers));
    this.assignIfPresent(request, 'query', this.cleanRecord(node.query));
    this.assignIfPresent(request, 'json', node.jsonBody);

    const expect = {
      status: node.expectStatus ?? 200,
      json_contains: node.jsonContains,
      assertions: this.toAssertions(node.assertions),
    };
    this.assignIfPresent(request, 'expect', this.cleanRecord(expect));
    this.assignIfPresent(request, 'save', this.cleanRecord(node.save));

    return request;
  }

  private toAssertions(assertions: FlowAssertion[] | undefined): CompiledAssertion[] | undefined {
    const entries = (assertions ?? [])
      .filter((assertion) => assertion.fieldPath?.trim() && assertion.operator)
      .map((assertion) => ({
        field_path: assertion.fieldPath.trim(),
        operator: assertion.operator,
        ...(assertion.expectedValue !== undefined && assertion.expectedValue !== ''
          ? { expected_value: assertion.expectedValue }
          : {}),
      }));
    return entries.length > 0 ? entries : undefined;
  }

  private normalizeNode(node: FlowNode): FlowNode {
    if (!node.type) {
      return { ...node, type: 'apiRequest' } as FlowApiNode;
    }
    return node;
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

  private assignIfPresent<T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K] | undefined,
  ): void {
    if (value !== undefined) {
      target[key] = value;
    }
  }

  private cleanRecord<T extends Record<string, unknown>>(record: T | undefined): T | undefined {
    if (!record || typeof record !== 'object') {
      return undefined;
    }

    const entries = Object.entries(record).filter(
      ([, value]) => value !== undefined && value !== '',
    );
    return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
  }
}
