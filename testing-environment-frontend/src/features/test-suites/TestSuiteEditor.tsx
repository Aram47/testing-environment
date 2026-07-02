import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { YamlEditor } from '../../editors/YamlEditor';
import { testSuiteExample } from '../../lib/examples';
import { YamlValidator } from '../../lib/yaml';
import type { TestSuite } from '../../types';

interface TestSuiteEditorProps {
  value?: TestSuite;
  isSaving: boolean;
  onSave: (value: { name: string; yamlContent: string }) => void;
  onDelete?: () => void;
  onBack: () => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export function TestSuiteEditor({ value, isSaving, onSave, onDelete, onBack, onMessage }: TestSuiteEditorProps) {
  const [name, setName] = useState(value?.name ?? 'Auth API');
  const [yaml, setYaml] = useState(value?.yaml ?? testSuiteExample);

  const validate = () => {
    const result = YamlValidator.validate(yaml);
    if (!result.ok) {
      onMessage(result.message, 'error');
      return false;
    }
    onMessage('YAML is valid', 'success');
    return true;
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (validate()) {
          onSave({ name, yamlContent: yaml });
        }
      }}
    >
      <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Suite name</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </section>
      <YamlEditor label="Test suite YAML" value={yaml} onChange={setYaml} minRows={24} />
      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>Back to suites</Button>
        <div className="flex flex-wrap gap-3">
          {onDelete ? <Button type="button" variant="danger" onClick={onDelete}>Delete</Button> : null}
          <Button type="button" variant="secondary" onClick={validate}>Validate YAML</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </form>
  );
}
