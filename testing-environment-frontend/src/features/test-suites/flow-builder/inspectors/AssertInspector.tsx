import type { FlowAssertNode, FlowAssertionOperator, FlowNode } from '../../../../types';
import type { FlowValidationIssue } from '../types';
import { ExecutionFields } from './ExecutionFields';
import { VariablePicker } from './fields/FormFields';
import { TextField } from './fields/TextField';

const assertionOperators: FlowAssertionOperator[] = ['equals', 'contains', 'exists'];

function hasFieldIssue(issues: FlowValidationIssue[], field: FlowValidationIssue['field']): boolean {
  return issues.some((issue) => issue.field === field);
}

export function AssertInspector({
  node,
  variables,
  readOnly = false,
  issues,
  onChange,
}: {
  node: FlowAssertNode;
  variables: string[];
  readOnly?: boolean;
  issues: FlowValidationIssue[];
  onChange: (node: FlowNode) => void;
}) {
  const update = (changes: Partial<FlowAssertNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField nodeId={node.id} field="name" label="Name" value={node.name} readOnly={readOnly} invalid={hasFieldIssue(issues, 'name')} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} readOnly={readOnly} onChange={update} />
      <VariablePicker variables={variables} />
      <TextField nodeId={node.id} field="name" label="Source step ID" value={node.sourceStepId ?? ''} readOnly={readOnly} onChange={(sourceStepId) => update({ sourceStepId })} />
      <TextField nodeId={node.id} field="fieldPath" label="Field path" value={node.fieldPath} readOnly={readOnly} invalid={hasFieldIssue(issues, 'fieldPath')} onChange={(fieldPath) => update({ fieldPath })} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Operator</span>
        <select className="input" disabled={readOnly} value={node.operator} onChange={(event) => update({ operator: event.target.value as FlowAssertionOperator })}>
          {assertionOperators.map((operator) => (
            <option key={operator} value={operator}>
              {operator}
            </option>
          ))}
        </select>
      </label>
      {node.operator !== 'exists' ? (
        <TextField nodeId={node.id} field="name" label="Expected value" value={node.expectedValue ?? ''} readOnly={readOnly} onChange={(expectedValue) => update({ expectedValue })} />
      ) : null}
    </>
  );
}
