import { useId } from 'react';

interface YamlEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
}

export function YamlEditor({ label, value, onChange, minRows = 16 }: YamlEditorProps) {
  const id = useId();

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm font-semibold text-ink">{label}</span>
      <textarea
        id={id}
        name={id}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        className="focus-ring w-full resize-y rounded-md border border-border bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 shadow-sm"
      />
    </label>
  );
}
