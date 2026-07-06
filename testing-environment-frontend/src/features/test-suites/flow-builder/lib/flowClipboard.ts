import type { Edge } from '@xyflow/react';
import type { FlowNode } from '../../../../types';
import type { FlowEditorNode } from '../types';
import { toReactNode } from './flowSerialization';

export interface FlowClipboardPayload {
  nodes: FlowNode[];
  edges: Array<{ source: string; target: string }>;
}

let internalClipboard: FlowClipboardPayload | null = null;

export function copySelection(nodes: FlowEditorNode[], edges: Edge[], selectedIds: string[]): FlowClipboardPayload {
  const selectedSet = new Set(selectedIds);
  const selectedNodes = nodes.filter((node) => selectedSet.has(node.id));
  const payload: FlowClipboardPayload = {
    nodes: selectedNodes.map((node) => ({ ...node.data.flowNode, position: { ...node.position } })),
    edges: edges
      .filter((edge) => selectedSet.has(edge.source) && selectedSet.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target })),
  };
  internalClipboard = payload;
  void navigator.clipboard?.writeText(JSON.stringify(payload)).catch(() => undefined);
  return payload;
}

export function readClipboard(): FlowClipboardPayload | null {
  return internalClipboard;
}

export function pasteClipboard(
  payload: FlowClipboardPayload,
  existingNodes: FlowEditorNode[],
  offset = { x: 40, y: 40 },
): { nodes: FlowEditorNode[]; edges: Edge[] } {
  const idMap = new Map<string, string>();
  const timestamp = Date.now();

  const pastedNodes = payload.nodes.map((node, index) => {
    const newId = `${node.type ?? 'apiRequest'}-${timestamp}-${index}`;
    idMap.set(node.id, newId);
    const position = {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y,
    };
    return toReactNode({
      ...node,
      id: newId,
      position,
    });
  });

  const pastedEdges: Edge[] = payload.edges.map((edge, index) => ({
    id: `edge-${idMap.get(edge.source)}-${idMap.get(edge.target)}-${timestamp}-${index}`,
    source: idMap.get(edge.source)!,
    target: idMap.get(edge.target)!,
  }));

  return {
    nodes: [...existingNodes, ...pastedNodes],
    edges: pastedEdges,
  };
}

export function duplicateNodes(
  nodes: FlowEditorNode[],
  edges: Edge[],
  selectedIds: string[],
): { nodes: FlowEditorNode[]; edges: Edge[]; newIds: string[] } {
  const payload = copySelection(nodes, edges, selectedIds);
  const result = pasteClipboard(payload, nodes);
  const newIds = result.nodes.slice(nodes.length).map((node) => node.id);
  return { nodes: result.nodes, edges: [...edges, ...result.edges], newIds };
}
