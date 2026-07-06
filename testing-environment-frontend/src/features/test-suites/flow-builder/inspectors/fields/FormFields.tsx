import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../../components/ui/Button';
import type { FlowAssertion, FlowAssertionOperator } from '../../../../../types';
import type { FlowValidationIssue } from '../../types';
import { fieldElementId } from '../../lib/flowNodeUtils';

const assertionOperators: FlowAssertionOperator[] = ['equals', 'contains', 'exists'];

function replaceRow<T>(rows: T[], index: number, row: T): T[] {
  return rows.map((item, itemIndex) => (itemIndex === index ? row : item));
}

export function AssertionBuilder({
  nodeId,
  value,
  readOnly = false,
  invalid = false,
  onChange,
}: {
  nodeId: string;
  value: FlowAssertion[];
  readOnly?: boolean;
  invalid?: boolean;
  onChange: (value: FlowAssertion[] | undefined) => void;
}) {
  const updateRows = (rows: FlowAssertion[]) => {
    const cleanRows = rows.filter((row) => row.fieldPath.trim());
    onChange(cleanRows.length > 0 ? cleanRows : undefined);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">Response assertions</h3>
        {!readOnly ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 px-3"
            onClick={() => updateRows([...value, { id: `assertion-${Date.now()}`, fieldPath: '$.', operator: 'exists' }])}
          >
            <Plus size={14} /> Add
          </Button>
        ) : null}
      </div>
      {value.length === 0 ? <p className="rounded-md bg-slate-50 p-3 text-xs text-muted">No assertions. Expected status is still checked.</p> : null}
      {value.map((assertion, index) => (
        <div key={assertion.id ?? `${assertion.fieldPath}-${index}`} className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
            <input
              id={index === 0 ? fieldElementId(nodeId, 'assertions') : undefined}
              className="input"
              aria-label="Response field path"
              aria-invalid={invalid}
              readOnly={readOnly}
              placeholder="$.data.status"
              value={assertion.fieldPath}
              onChange={(event) => updateRows(replaceRow(value, index, { ...assertion, fieldPath: event.target.value }))}
            />
            <select
              className="input"
              aria-label="Assertion operator"
              disabled={readOnly}
              value={assertion.operator}
              onChange={(event) => updateRows(replaceRow(value, index, { ...assertion, operator: event.target.value as FlowAssertionOperator }))}
            >
              {assertionOperators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
            {!readOnly ? (
              <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={() => updateRows(value.filter((_, rowIndex) => rowIndex !== index))}>
                <Trash2 size={16} />
              </Button>
            ) : null}
          </div>
          {assertion.operator !== 'exists' ? (
            <input
              className="input"
              aria-label="Expected value"
              readOnly={readOnly}
              placeholder="Expected value"
              value={assertion.expectedValue ?? ''}
              onChange={(event) => updateRows(replaceRow(value, index, { ...assertion, expectedValue: event.target.value }))}
            />
          ) : null}
        </div>
      ))}
    </section>
  );
}

export function JsonField({ label, value, readOnly = false, onChange }: { label: string; value: unknown; readOnly?: boolean; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(() => formatJson(value));
  const [error, setError] = useState('');

  useEffect(() => {
    setText(formatJson(value));
    setError('');
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <textarea
        className="input min-h-28 font-mono"
        spellCheck={false}
        readOnly={readOnly}
        placeholder={'{"id": "{{ user_id }}"}'}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (!next.trim()) {
            setError('');
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(next));
            setError('');
          } catch {
            setError('Invalid JSON');
          }
        }}
      />
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

export function VariablePicker({ variables }: { variables: string[] }) {
  if (variables.length === 0) {
    return <p className="rounded-md bg-slate-50 p-3 text-xs text-muted">Saved variables will appear here after you add them to previous steps.</p>;
  }

  const copyVariable = (variable: string) => {
    void navigator.clipboard?.writeText(`{{ ${variable} }}`);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-ink">Variables</h3>
      <div className="flex flex-wrap gap-2">
        {variables.map((variable) => (
          <button
            key={variable}
            type="button"
            className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-2 text-xs font-medium text-ink"
            onClick={() => copyVariable(variable)}
          >
            {`{{ ${variable} }}`}
          </button>
        ))}
      </div>
    </section>
  );
}

export function RecordTable({
  nodeId,
  field,
  label,
  keyLabel,
  valueLabel,
  value,
  readOnly = false,
  invalid = false,
  onChange,
}: {
  nodeId: string;
  field: FlowValidationIssue['field'];
  label: string;
  keyLabel: string;
  valueLabel: string;
  value?: Record<string, string>;
  readOnly?: boolean;
  invalid?: boolean;
  onChange: (value: Record<string, string> | undefined) => void;
}) {
  const rows = Object.entries(value ?? {}).map(([key, entryValue], index) => ({ id: `${key}-${index}`, key, value: entryValue }));
  const updateRows = (nextRows: Array<{ key: string; value: string }>) => {
    const entries = nextRows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value] as const);
    onChange(entries.length > 0 ? Object.fromEntries(entries) : undefined);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">{label}</h3>
        {!readOnly ? (
          <Button type="button" variant="secondary" className="min-h-9 px-3" onClick={() => updateRows([...rows, { key: '', value: '' }])}>
            <Plus size={14} /> Add
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? <p className="rounded-md bg-slate-50 p-3 text-xs text-muted">No rows yet.</p> : null}
      {rows.map((row, index) => (
        <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            id={index === 0 && field ? fieldElementId(nodeId, field) : undefined}
            className="input"
            aria-label={keyLabel}
            aria-invalid={invalid}
            readOnly={readOnly}
            placeholder={keyLabel}
            value={row.key}
            onChange={(event) => updateRows(replaceRow(rows, index, { ...row, key: event.target.value }))}
          />
          <input
            className="input"
            aria-label={valueLabel}
            readOnly={readOnly}
            placeholder={valueLabel}
            value={row.value}
            onChange={(event) => updateRows(replaceRow(rows, index, { ...row, value: event.target.value }))}
          />
          {!readOnly ? (
            <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={() => updateRows(rows.filter((_, rowIndex) => rowIndex !== index))}>
              <Trash2 size={16} />
            </Button>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function formatJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}

function recordToStringMap(value?: Record<string, unknown>): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, String(entryValue)]));
}

export { recordToStringMap };
