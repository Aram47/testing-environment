import type { Edge, Node } from '@xyflow/react';
import type { FlowNode, FlowSuiteDefinition, TestResult } from '../../../types';

export type FlowNodeData = Record<string, unknown> & {
  flowNode: FlowNode;
  validationStatus?: 'valid' | 'error';
  executionResult?: TestResult;
  searchMatch?: boolean;
};

export type FlowEditorNode = Node<FlowNodeData, 'flowStep'>;

export type FlowValidationField =
  | 'name'
  | 'path'
  | 'durationMs'
  | 'variableName'
  | 'fieldPath'
  | 'timeoutSeconds'
  | 'intervalSeconds'
  | 'assertions'
  | 'save'
  | 'graph';

export interface FlowValidationIssue {
  nodeId: string;
  field?: FlowValidationField;
  message: string;
}

export type FlowViewMode = 'canvas' | 'outline';

export interface FlowEditorSnapshot {
  nodes: FlowEditorNode[];
  edges: Edge[];
}

export interface FlowSuiteEditorProps {
  projectId: string;
  suiteId?: string;
  suiteName: string;
  initialFlow?: FlowSuiteDefinition;
  initialYaml: string;
  onSave: (visualFlow: FlowSuiteDefinition) => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
  executionResults?: Record<string, TestResult>;
}

export interface FlowDraftRecord {
  flow: FlowSuiteDefinition;
  savedAt: number;
}

export type NodeTemplateId =
  | 'health-check'
  | 'create-resource'
  | 'poll-status'
  | 'wait-1s'
  | 'assert-field';
