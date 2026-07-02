import { BadRequestException, Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { FlowApiNode, FlowCompileResult, FlowEdge, FlowSuiteDefinition } from './types/flow-suite.types';

interface CompiledTestRequest {
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
}

interface CompiledTestCase {
  name: string;
  request: CompiledTestRequest;
}

@Injectable()
export class FlowSuiteCompilerService {
  compile(flow: FlowSuiteDefinition): FlowCompileResult {
    this.validateShape(flow);
    const orderedNodes = this.sortNodes(flow.nodes, flow.edges);
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
    for (const node of flow.nodes) {
      if (!node.id?.trim()) {
        throw new BadRequestException('Every API node must have an id');
      }
      if (ids.has(node.id)) {
        throw new BadRequestException(`Duplicate API node id: ${node.id}`);
      }
      ids.add(node.id);
      if (!node.name?.trim()) {
        throw new BadRequestException(`API node ${node.id} is missing a name`);
      }
      if (!node.method?.trim()) {
        throw new BadRequestException(`API node ${node.name} is missing a method`);
      }
      if (!node.path?.trim()) {
        throw new BadRequestException(`API node ${node.name} is missing a path`);
      }
    }
  }

  private sortNodes(nodes: FlowApiNode[], edges: FlowEdge[]): FlowApiNode[] {
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
    const ordered: FlowApiNode[] = [];

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

  private buildWarnings(nodes: FlowApiNode[]): string[] {
    const warnings: string[] = [];
    const savedBy = new Map<string, string>();

    for (const node of nodes) {
      for (const key of Object.keys(node.save ?? {})) {
        const owner = savedBy.get(key);
        if (owner) {
          warnings.push(`Variable "${key}" is saved by both "${owner}" and "${node.name}".`);
        }
        savedBy.set(key, node.name);
      }
    }

    return warnings;
  }

  private toTestCase(node: FlowApiNode): CompiledTestCase {
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
    };
    this.assignIfPresent(request, 'expect', this.cleanRecord(expect));
    this.assignIfPresent(request, 'save', this.cleanRecord(node.save));

    return {
      name: node.name,
      request,
    };
  }

  private assignIfPresent<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
    if (value !== undefined) {
      target[key] = value;
    }
  }

  private cleanRecord<T extends Record<string, unknown>>(record: T | undefined): T | undefined {
    if (!record || typeof record !== 'object') {
      return undefined;
    }

    const entries = Object.entries(record).filter(([, value]) => value !== undefined && value !== '');
    return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
  }
}
