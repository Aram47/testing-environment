import type { Edge } from '@xyflow/react';
import type { FlowEditorNode } from '../types';
import { topologicalSort } from './flowGraph';

const HORIZONTAL_GAP = 280;
const BASE_X = 80;
const BASE_Y = 120;

export function autoLayout(nodes: FlowEditorNode[], edges: Edge[]): FlowEditorNode[] {
  const nodeIds = nodes.map((node) => node.id);
  const orderedIds = topologicalSort(nodeIds, edges);

  return nodes.map((node) => {
    const index = orderedIds.indexOf(node.id);
    const position = { x: BASE_X + index * HORIZONTAL_GAP, y: BASE_Y };
    return {
      ...node,
      position,
      data: {
        ...node.data,
        flowNode: { ...node.data.flowNode, position },
      },
    };
  });
}
