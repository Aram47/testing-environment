import type { FlowApiNode, FlowNode } from '../../../../types';
import type { FlowValidationIssue } from '../types';
import { ExecutionFields } from './ExecutionFields';
import { RequestFields } from './RequestFields';
import { TextField } from './fields/TextField';

function hasFieldIssue(issues: FlowValidationIssue[], field: FlowValidationIssue['field']): boolean {
  return issues.some((issue) => issue.field === field);
}

export function ApiInspector({
  node,
  variables,
  readOnly = false,
  issues,
  onChange,
}: {
  node: FlowApiNode;
  variables: string[];
  readOnly?: boolean;
  issues: FlowValidationIssue[];
  onChange: (node: FlowNode) => void;
}) {
  const update = (changes: Partial<FlowApiNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField nodeId={node.id} field="name" label="Name" value={node.name} readOnly={readOnly} invalid={hasFieldIssue(issues, 'name')} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} readOnly={readOnly} onChange={update} />
      <RequestFields node={node} variables={variables} readOnly={readOnly} issues={issues} onChange={update} />
    </>
  );
}
