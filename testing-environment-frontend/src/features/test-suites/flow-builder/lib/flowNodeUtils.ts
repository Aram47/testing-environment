import type {
  FlowApiNode,
  FlowAssertNode,
  FlowNode,
  FlowPollUntilNode,
  FlowRetryPolicy,
  FlowSetVariableNode,
  FlowWaitNode,
} from '../../../../types';
import type { FlowEditorNode } from '../types';

export const defaultRetryPolicy: FlowRetryPolicy = { maxAttempts: 1, backoffMs: 0 };

export function isWaitNode(node: FlowNode): node is FlowWaitNode {
  return node.type === 'wait';
}

export function isPollNode(node: FlowNode): node is FlowPollUntilNode {
  return node.type === 'pollUntil';
}

export function isSetVariableNode(node: FlowNode): node is FlowSetVariableNode {
  return node.type === 'setVariable';
}

export function isAssertNode(node: FlowNode): node is FlowAssertNode {
  return node.type === 'assert';
}

export function isApiNode(node: FlowNode): node is FlowApiNode {
  return node.type === 'apiRequest' || node.type === undefined;
}

export function normalizeNode(node: FlowNode): FlowNode {
  const type = node.type ?? 'apiRequest';
  return {
    ...node,
    type,
    version: node.version ?? `${type}/v1`,
    timeoutMs: node.timeoutMs ?? 30000,
    retryPolicy: node.retryPolicy ?? defaultRetryPolicy,
    continueOnFailure: node.continueOnFailure === true,
  } as FlowNode;
}

export function stepTypeLabel(node: FlowNode): string {
  if (isWaitNode(node)) {
    return 'Wait';
  }
  if (isPollNode(node)) {
    return 'Poll until';
  }
  if (isSetVariableNode(node)) {
    return 'Set variable';
  }
  if (isAssertNode(node)) {
    return 'Assert';
  }
  return node.method;
}

export function stepSummary(node: FlowNode): string {
  if (isWaitNode(node)) {
    return `${node.durationMs} ms`;
  }
  if (isPollNode(node)) {
    return `${node.method} ${node.path} for ${node.timeoutSeconds}s`;
  }
  if (isSetVariableNode(node)) {
    return node.variableName;
  }
  if (isAssertNode(node)) {
    return `${node.fieldPath} ${node.operator}`;
  }
  return node.path;
}

export function collectVariables(nodes: FlowEditorNode[]): string[] {
  const variables = nodes.flatMap((node) => {
    const flowNode = node.data.flowNode;
    if (isWaitNode(flowNode) || isAssertNode(flowNode)) {
      return [];
    }
    if (isSetVariableNode(flowNode)) {
      return [flowNode.variableName];
    }
    return Object.keys(flowNode.save ?? {});
  });
  return [...new Set(variables.filter(Boolean))];
}

export function nodeMatchesSearch(node: FlowNode, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const haystack = [node.name, node.id, stepTypeLabel(node), stepSummary(node), isApiNode(node) || isPollNode(node) ? node.path : '']
    .join(' ')
    .toLowerCase();
  return haystack.includes(normalized);
}

export function fieldElementId(nodeId: string, field: string): string {
  return `field-${nodeId}-${field}`;
}
