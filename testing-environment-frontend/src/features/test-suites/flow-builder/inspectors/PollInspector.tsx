import type { FlowNode, FlowPollUntilNode } from '../../../../types';
import type { FlowValidationIssue } from '../types';
import { ExecutionFields } from './ExecutionFields';
import { RequestFields } from './RequestFields';
import { NumberField, TextField } from './fields/TextField';

function hasFieldIssue(issues: FlowValidationIssue[], field: FlowValidationIssue['field']): boolean {
  return issues.some((issue) => issue.field === field);
}

export function PollInspector({
  node,
  variables,
  readOnly = false,
  issues,
  onChange,
}: {
  node: FlowPollUntilNode;
  variables: string[];
  readOnly?: boolean;
  issues: FlowValidationIssue[];
  onChange: (node: FlowNode) => void;
}) {
  const update = (changes: Partial<FlowPollUntilNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField nodeId={node.id} field="name" label="Name" value={node.name} readOnly={readOnly} invalid={hasFieldIssue(issues, 'name')} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} readOnly={readOnly} onChange={update} />
      <RequestFields node={node} variables={variables} readOnly={readOnly} issues={issues} onChange={update} />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField nodeId={node.id} field="timeoutSeconds" label="Timeout seconds" value={node.timeoutSeconds} readOnly={readOnly} invalid={hasFieldIssue(issues, 'timeoutSeconds')} onChange={(timeoutSeconds) => update({ timeoutSeconds })} />
        <NumberField nodeId={node.id} field="intervalSeconds" label="Retry interval seconds" value={node.intervalSeconds} readOnly={readOnly} invalid={hasFieldIssue(issues, 'intervalSeconds')} onChange={(intervalSeconds) => update({ intervalSeconds })} />
      </div>
      <TextField nodeId={node.id} field="name" label="Failure message" value={node.failureMessage ?? ''} readOnly={readOnly} onChange={(failureMessage) => update({ failureMessage })} />
    </>
  );
}
