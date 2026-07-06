import { applyNodeChanges, type Edge, type NodeChange } from '@xyflow/react';
import type { FlowNode, FlowSuiteDefinition } from '../../../../types';
import type { FlowEditorNode } from '../types';
import { normalizeNode } from './flowNodeUtils';

export function toReactNodes(flow?: FlowSuiteDefinition): FlowEditorNode[] {
  return (flow?.nodes ?? []).map((node) => toReactNode(normalizeNode(node)));
}

export function toReactNode(flowNode: FlowNode): FlowEditorNode {
  return {
    id: flowNode.id,
    type: 'flowStep',
    position: flowNode.position,
    data: { flowNode },
  };
}

export function toReactEdges(flow?: FlowSuiteDefinition): Edge[] {
  return (flow?.edges ?? []).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }));
}

export function applyFlowNodeChanges(changes: NodeChange<FlowEditorNode>[], nodes: FlowEditorNode[]): FlowEditorNode[] {
  return applyNodeChanges(changes, nodes).map((node) => ({
    ...node,
    data: {
      ...node.data,
      flowNode: {
        ...node.data.flowNode,
        position: node.position,
      },
    },
  }));
}

export function buildFlowDefinition(
  suiteName: string,
  nodes: FlowEditorNode[],
  edges: Edge[],
): FlowSuiteDefinition {
  return {
    version: '1.1',
    suiteName,
    nodes: nodes.map((node) => ({
      ...node.data.flowNode,
      position: node.position,
    })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  };
}
