import { BadRequestException, Injectable } from '@nestjs/common';
import { CURRENT_VISUAL_DSL_VERSION } from './types/execution-plan.types';
import { FlowNode, FlowSuiteDefinition } from './types/flow-suite.types';

@Injectable()
export class VisualDslMigratorService {
  migrate(flow: FlowSuiteDefinition): FlowSuiteDefinition {
    if (!flow || typeof flow !== 'object') {
      throw new BadRequestException('Flow definition is required');
    }
    if (flow.version !== '1.0' && flow.version !== CURRENT_VISUAL_DSL_VERSION) {
      throw new BadRequestException('Unsupported flow version');
    }
    return {
      ...flow,
      version: CURRENT_VISUAL_DSL_VERSION,
      nodes: flow.nodes.map((node) => this.migrateNode(node)),
      edges: flow.edges ?? [],
    };
  }

  private migrateNode(node: FlowNode): FlowNode {
    const type = node.type ?? 'apiRequest';
    return {
      ...node,
      type,
      version: node.version ?? `${type}/v1`,
      timeoutMs: node.timeoutMs ?? this.defaultTimeoutMs(type),
      retryPolicy: node.retryPolicy ?? { maxAttempts: 1, backoffMs: 0 },
      continueOnFailure: node.continueOnFailure === true,
    } as FlowNode;
  }

  private defaultTimeoutMs(type: string): number {
    if (type === 'wait') {
      return 60000;
    }
    if (type === 'pollUntil') {
      return 30000;
    }
    return 30000;
  }
}
