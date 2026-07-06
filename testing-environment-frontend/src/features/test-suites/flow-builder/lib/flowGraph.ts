import type { Edge } from '@xyflow/react';
import type { FlowSuiteDefinition } from '../../../../types';

export function buildAdjacency(edges: Edge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const next = adjacency.get(edge.source) ?? [];
    next.push(edge.target);
    adjacency.set(edge.source, next);
  }
  return adjacency;
}

export function topologicalSort(nodeIds: string[], edges: Edge[]): string[] {
  const incoming = new Map<string, number>();
  const adjacency = buildAdjacency(edges);

  for (const id of nodeIds) {
    incoming.set(id, 0);
  }
  for (const edge of edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  const queue = nodeIds.filter((id) => (incoming.get(id) ?? 0) === 0);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const count = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, count);
      if (count === 0) {
        queue.push(next);
      }
    }
  }

  if (ordered.length !== nodeIds.length) {
    return ordered;
  }
  return ordered;
}

export function hasCycle(nodeIds: string[], edges: Edge[]): boolean {
  return topologicalSort(nodeIds, edges).length !== nodeIds.length;
}

export function hasBranching(edges: Edge[]): boolean {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const edge of edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
  }
  return [...incoming.values(), ...outgoing.values()].some((count) => count > 1);
}

export function canConnectLinear(source: string, target: string, edges: Edge[]): boolean {
  if (source === target) {
    return false;
  }
  const incoming = edges.filter((edge) => edge.target === target).length;
  const outgoing = edges.filter((edge) => edge.source === source).length;
  return incoming === 0 && outgoing === 0;
}

export function findOrphanNodeIds(nodeIds: string[], edges: Edge[]): string[] {
  if (nodeIds.length <= 1) {
    return [];
  }
  if (edges.length === 0) {
    return nodeIds.slice(1);
  }
  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  return nodeIds.filter((id) => !connected.has(id));
}

export function findDuplicateIds(nodeIds: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of nodeIds) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
}

export function serializeFlowForCompare(flow: FlowSuiteDefinition): string {
  return JSON.stringify({
    version: flow.version,
    suiteName: flow.suiteName,
    nodes: flow.nodes.map(stripNodePosition),
    edges: flow.edges,
  });
}

function stripNodePosition(node: FlowSuiteDefinition['nodes'][number]) {
  const { position, ...rest } = node;
  void position;
  return rest;
}
