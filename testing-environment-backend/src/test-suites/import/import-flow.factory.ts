import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiImportTemplate, ImportedApiOperation, ImportWarning } from '../types/api-import.types';
import {
  FlowApiNode,
  FlowEdge,
  FlowNode,
  FlowPollUntilNode,
  FlowSuiteDefinition,
} from '../types/flow-suite.types';
import { ImportWarningService } from './import-warning.service';
import { expectedStatus, stableOperationId } from './parsers/import-parser-utils';

@Injectable()
export class ImportFlowFactory {
  constructor(private readonly warningService: ImportWarningService) {}

  create(
    suiteName: string,
    template: ApiImportTemplate,
    operations: ImportedApiOperation[],
    acknowledgeDestructive = false,
  ): { flow: FlowSuiteDefinition; warnings: ImportWarning[] } {
    if (!suiteName?.trim()) {
      throw new BadRequestException('Suite name is required');
    }
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new BadRequestException('At least one imported operation must be selected');
    }
    const destructive = operations.filter((operation) =>
      this.warningService.isDestructive(operation.method),
    );
    if (destructive.length > 0 && !acknowledgeDestructive) {
      throw new BadRequestException(
        'Destructive imported operations require acknowledgeDestructive=true',
      );
    }

    const warnings: ImportWarning[] = [];
    const selected = this.selectOperations(template, operations, warnings);
    if (selected.length === 0) {
      throw new BadRequestException('Selected template did not produce any flow steps');
    }

    const nodes =
      template === 'ASYNC_POLLING'
        ? this.asyncPollingNodes(selected, warnings)
        : selected.map((operation, index) => this.apiNode(operation, index));
    const edges = this.linearEdges(nodes);
    return {
      flow: {
        version: '1.1',
        suiteName: suiteName.trim(),
        nodes,
        edges,
      },
      warnings,
    };
  }

  private selectOperations(
    template: ApiImportTemplate,
    operations: ImportedApiOperation[],
    warnings: ImportWarning[],
  ): ImportedApiOperation[] {
    if (template === 'SMOKE_TEST') {
      const safe = operations.filter((operation) =>
        ['GET', 'HEAD', 'OPTIONS'].includes(operation.method.toUpperCase()),
      );
      if (safe.length < operations.length) {
        warnings.push({
          code: 'SMOKE_TEMPLATE_FILTERED_MUTATIONS',
          severity: 'info',
          message: 'Smoke test template uses only read-only operations.',
        });
      }
      return safe.length > 0 ? safe : operations;
    }
    if (template === 'READINESS_TEST') {
      const readiness = operations.filter((operation) =>
        /health|ready|readiness|live|status/i.test(operation.path),
      );
      if (readiness.length === 0) {
        warnings.push({
          code: 'READINESS_ENDPOINT_NOT_FOUND',
          severity: 'warning',
          message:
            'No obvious readiness endpoint was found; selected read-only operations will be used.',
        });
      }
      return readiness.length > 0
        ? readiness
        : operations.filter((operation) =>
            ['GET', 'HEAD'].includes(operation.method.toUpperCase()),
          );
    }
    if (template === 'CRUD_LIFECYCLE') {
      return [...operations].sort((left, right) => this.crudRank(left) - this.crudRank(right));
    }
    return operations;
  }

  private asyncPollingNodes(
    operations: ImportedApiOperation[],
    warnings: ImportWarning[],
  ): FlowNode[] {
    const [start, ...rest] = operations;
    const pollOperation =
      rest.find((operation) => /status|health|ready|progress|poll/i.test(operation.path)) ??
      operations.find((operation) => /status|health|ready|progress|poll/i.test(operation.path));
    if (!pollOperation || pollOperation.id === start.id) {
      warnings.push({
        code: 'ASYNC_POLL_ENDPOINT_NOT_FOUND',
        severity: 'warning',
        message:
          'Async polling template could not find a distinct status endpoint; generated a single request step.',
      });
      return [this.apiNode(start, 0)];
    }
    return [this.apiNode(start, 0), this.pollNode(pollOperation, 1)];
  }

  private apiNode(operation: ImportedApiOperation, index: number): FlowApiNode {
    return {
      id: this.nodeId(operation, index, 'api'),
      type: 'apiRequest',
      version: 'apiRequest/v1',
      position: { x: 80 + index * 280, y: 120 },
      name: operation.name,
      method: operation.method.toUpperCase(),
      path: operation.path,
      headers: operation.headers,
      query: operation.query,
      jsonBody: operation.body,
      expectStatus: expectedStatus(operation.expectedResponses),
      timeoutMs: 30000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
      continueOnFailure: false,
    };
  }

  private pollNode(operation: ImportedApiOperation, index: number): FlowPollUntilNode {
    return {
      ...this.apiNode(operation, index),
      id: this.nodeId(operation, index, 'poll'),
      type: 'pollUntil',
      version: 'pollUntil/v1',
      timeoutSeconds: 60,
      intervalSeconds: 2,
      failureMessage: `Polling ${operation.path} did not reach expected status.`,
    };
  }

  private linearEdges(nodes: FlowNode[]): FlowEdge[] {
    return nodes.slice(1).map((node, index) => ({
      id: `edge-${nodes[index].id}-${node.id}`,
      source: nodes[index].id,
      target: node.id,
    }));
  }

  private crudRank(operation: ImportedApiOperation): number {
    const method = operation.method.toUpperCase();
    if (method === 'POST') {
      return 0;
    }
    if (method === 'GET') {
      return 1;
    }
    if (method === 'PUT' || method === 'PATCH') {
      return 2;
    }
    if (method === 'DELETE') {
      return 3;
    }
    return 4;
  }

  private nodeId(operation: ImportedApiOperation, index: number, prefix: string): string {
    return stableOperationId([prefix, String(index + 1), operation.id]);
  }
}
