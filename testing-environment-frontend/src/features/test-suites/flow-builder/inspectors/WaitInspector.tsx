import type { FlowNode, FlowWaitNode } from '../../../../types';
import type { FlowValidationIssue } from '../types';
import { ExecutionFields } from './ExecutionFields';
import { NumberField, TextField } from './fields/TextField';

function hasFieldIssue(issues: FlowValidationIssue[], field: FlowValidationIssue['field']): boolean {
  return issues.some((issue) => issue.field === field);
}

export function WaitInspector({
  node,
  readOnly = false,
  issues,
  onChange,
}: {
  node: FlowWaitNode;
  readOnly?: boolean;
  issues: FlowValidationIssue[];
  onChange: (node: FlowNode) => void;
}) {
  const update = (changes: Partial<FlowWaitNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField nodeId={node.id} field="name" label="Name" value={node.name} readOnly={readOnly} invalid={hasFieldIssue(issues, 'name')} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} readOnly={readOnly} onChange={update} />
      <NumberField nodeId={node.id} field="durationMs" label="Duration milliseconds" value={node.durationMs} readOnly={readOnly} invalid={hasFieldIssue(issues, 'durationMs')} onChange={(durationMs) => update({ durationMs })} />
    </>
  );
}
