import type { FlowApiNode, FlowPollUntilNode } from '../../../../types';
import type { FlowValidationIssue } from '../types';
import { AssertionBuilder, JsonField, recordToStringMap, RecordTable, VariablePicker } from './fields/FormFields';
import { NumberField, TextField } from './fields/TextField';

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

type RequestFieldChanges = Partial<Pick<FlowApiNode, 'method' | 'path' | 'headers' | 'query' | 'jsonBody' | 'expectStatus' | 'assertions' | 'save'>>;

function hasFieldIssue(issues: FlowValidationIssue[], field: FlowValidationIssue['field']): boolean {
  return issues.some((issue) => issue.field === field);
}

export function RequestFields({
  node,
  variables,
  readOnly = false,
  issues,
  onChange,
}: {
  node: FlowApiNode | FlowPollUntilNode;
  variables: string[];
  readOnly?: boolean;
  issues: FlowValidationIssue[];
  onChange: (changes: RequestFieldChanges) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Method</span>
        <select className="input" disabled={readOnly} value={node.method} onChange={(event) => onChange({ method: event.target.value })}>
          {methods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <TextField nodeId={node.id} field="path" label="Path" value={node.path} readOnly={readOnly} invalid={hasFieldIssue(issues, 'path')} onChange={(path) => onChange({ path })} />
      <VariablePicker variables={variables} />
      <RecordTable nodeId={node.id} field="name" label="Headers" keyLabel="Header" valueLabel="Value" value={node.headers} readOnly={readOnly} onChange={(headers) => onChange({ headers })} />
      <RecordTable nodeId={node.id} field="name" label="Query params" keyLabel="Param" valueLabel="Value" value={recordToStringMap(node.query)} readOnly={readOnly} onChange={(query) => onChange({ query })} />
      <JsonField label="JSON body" value={node.jsonBody} readOnly={readOnly} onChange={(jsonBody) => onChange({ jsonBody })} />
      <NumberField nodeId={node.id} field="name" label="Expected status" value={node.expectStatus ?? 200} readOnly={readOnly} onChange={(expectStatus) => onChange({ expectStatus })} />
      <AssertionBuilder nodeId={node.id} value={node.assertions ?? []} readOnly={readOnly} invalid={hasFieldIssue(issues, 'assertions')} onChange={(assertions) => onChange({ assertions })} />
      <RecordTable nodeId={node.id} field="save" label="Save variables" keyLabel="Variable" valueLabel="Response path" value={node.save} readOnly={readOnly} invalid={hasFieldIssue(issues, 'save')} onChange={(save) => onChange({ save })} />
    </>
  );
}
