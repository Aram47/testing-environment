import type { FlowValidationField } from '../../types';
import { fieldElementId } from '../../lib/flowNodeUtils';

interface TextFieldProps {
  nodeId: string;
  field: FlowValidationField;
  label: string;
  value: string;
  type?: string;
  readOnly?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}

export function TextField({ nodeId, field, label, value, type = 'text', readOnly = false, invalid = false, onChange }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        id={fieldElementId(nodeId, field)}
        className="input"
        type={type}
        value={value}
        readOnly={readOnly}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function NumberField({
  nodeId,
  field,
  label,
  value,
  readOnly = false,
  invalid = false,
  onChange,
}: {
  nodeId: string;
  field: FlowValidationField;
  label: string;
  value: number;
  readOnly?: boolean;
  invalid?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <TextField
      nodeId={nodeId}
      field={field}
      label={label}
      type="number"
      value={String(value)}
      readOnly={readOnly}
      invalid={invalid}
      onChange={(nextValue) => onChange(Number(nextValue))}
    />
  );
}
