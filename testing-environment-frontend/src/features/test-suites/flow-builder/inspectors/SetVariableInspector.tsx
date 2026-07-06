import type { FlowNode, FlowSetVariableNode } from '../../../../types';
import type { FlowValidationIssue } from '../types';
import { ExecutionFields } from './ExecutionFields';
import { VariablePicker } from './fields/FormFields';
import { TextField } from './fields/TextField';

function hasFieldIssue(issues: FlowValidationIssue[], field: FlowValidationIssue['field']): boolean {
  return issues.some((issue) => issue.field === field);
}

export function SetVariableInspector({
  node,
  variables,
  readOnly = false,
  issues,
  onChange,
}: {
  node: FlowSetVariableNode;
  variables: string[];
  readOnly?: boolean;
  issues: FlowValidationIssue[];
  onChange: (node: FlowNode) => void;
}) {
  const update = (changes: Partial<FlowSetVariableNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField nodeId={node.id} field="name" label="Name" value={node.name} readOnly={readOnly} invalid={hasFieldIssue(issues, 'name')} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} readOnly={readOnly} onChange={update} />
      <TextField nodeId={node.id} field="variableName" label="Variable name" value={node.variableName} readOnly={readOnly} invalid={hasFieldIssue(issues, 'variableName')} onChange={(variableName) => update({ variableName })} />
      <TextField nodeId={node.id} field="name" label="Value" value={node.value ?? ''} readOnly={readOnly} onChange={(value) => update({ value })} />
      <VariablePicker variables={variables} />
      <TextField nodeId={node.id} field="name" label="Source step ID" value={node.fromStepId ?? ''} readOnly={readOnly} onChange={(fromStepId) => update({ fromStepId })} />
      <TextField nodeId={node.id} field="name" label="JSON path" value={node.path ?? ''} readOnly={readOnly} onChange={(path) => update({ path })} />
    </>
  );
}
