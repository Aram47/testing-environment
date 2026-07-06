import type { FlowSuiteDefinition } from '../../../../types';
import type { FlowValidationIssue } from '../types';
import { findDuplicateIds, findOrphanNodeIds, hasBranching, hasCycle } from './flowGraph';
import { isAssertNode, isPollNode, isSetVariableNode, isWaitNode, normalizeNode } from './flowNodeUtils';

export function validateFlow(flow: FlowSuiteDefinition): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const nodeIds = flow.nodes.map((node) => node.id);
  const duplicates = findDuplicateIds(nodeIds);

  for (const nodeId of duplicates) {
    issues.push({
      nodeId,
      field: 'graph',
      message: `Duplicate step id "${nodeId}".`,
    });
  }

  if (hasCycle(nodeIds, flow.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })))) {
    for (const node of flow.nodes) {
      issues.push({
        nodeId: node.id,
        field: 'graph',
        message: 'Flow contains a cycle. Steps must form a directed acyclic graph.',
      });
    }
  }

  if (hasBranching(flow.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })))) {
    for (const node of flow.nodes) {
      issues.push({
        nodeId: node.id,
        field: 'graph',
        message: 'Branching flows are not supported. Each step can have at most one incoming and one outgoing connection.',
      });
    }
  }

  for (const orphanId of findOrphanNodeIds(nodeIds, flow.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })))) {
    issues.push({
      nodeId: orphanId,
      field: 'graph',
      message: 'Step is not connected to the flow.',
    });
  }

  for (const node of flow.nodes.map(normalizeNode)) {
    if (!node.name.trim()) {
      issues.push({
        nodeId: node.id,
        field: 'name',
        message: `Step ${node.id} needs a name.`,
      });
    }
    if (isWaitNode(node)) {
      if (!Number.isFinite(node.durationMs) || node.durationMs <= 0) {
        issues.push({
          nodeId: node.id,
          field: 'durationMs',
          message: `Wait step "${node.name}" needs a duration greater than 0 ms.`,
        });
      }
      continue;
    }
    if (isSetVariableNode(node)) {
      if (!node.variableName.trim()) {
        issues.push({
          nodeId: node.id,
          field: 'variableName',
          message: `Set variable step "${node.name}" needs a variable name.`,
        });
      }
      continue;
    }
    if (isAssertNode(node)) {
      if (!node.fieldPath.trim()) {
        issues.push({
          nodeId: node.id,
          field: 'fieldPath',
          message: `Assert step "${node.name}" needs a response field path.`,
        });
      }
      continue;
    }
    if (!node.path.trim()) {
      issues.push({
        nodeId: node.id,
        field: 'path',
        message: `API step "${node.name}" needs a path.`,
      });
    }
    for (const key of Object.keys(node.save ?? {})) {
      if (!key.trim()) {
        issues.push({
          nodeId: node.id,
          field: 'save',
          message: `Saved variable in "${node.name}" needs a name.`,
        });
      }
    }
    for (const assertion of node.assertions ?? []) {
      if (!assertion.fieldPath.trim()) {
        issues.push({
          nodeId: node.id,
          field: 'assertions',
          message: `Assertion in "${node.name}" needs a response field path.`,
        });
      }
    }
    if (isPollNode(node)) {
      if (!Number.isFinite(node.timeoutSeconds) || node.timeoutSeconds <= 0) {
        issues.push({
          nodeId: node.id,
          field: 'timeoutSeconds',
          message: `Poll step "${node.name}" needs a timeout greater than 0 seconds.`,
        });
      }
      if (!Number.isFinite(node.intervalSeconds) || node.intervalSeconds <= 0) {
        issues.push({
          nodeId: node.id,
          field: 'intervalSeconds',
          message: `Poll step "${node.name}" needs a retry interval greater than 0 seconds.`,
        });
      }
      if (node.intervalSeconds > node.timeoutSeconds) {
        issues.push({
          nodeId: node.id,
          field: 'intervalSeconds',
          message: `Poll step "${node.name}" interval cannot be greater than timeout.`,
        });
      }
    }
  }

  return issues;
}

export function issuesForNode(issues: FlowValidationIssue[], nodeId: string): FlowValidationIssue[] {
  return issues.filter((issue) => issue.nodeId === nodeId);
}

export function issueMessages(issues: FlowValidationIssue[]): string[] {
  return issues.map((issue) => issue.message);
}

export function validationStatusForNode(issues: FlowValidationIssue[], nodeId: string): 'valid' | 'error' {
  return issuesForNode(issues, nodeId).length > 0 ? 'error' : 'valid';
}
