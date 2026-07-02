import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { YamlEditor } from '../../editors/YamlEditor';
import { testSuiteExample } from '../../lib/examples';
import { YamlValidator } from '../../lib/yaml';
import type { FlowSuiteDefinition, TestSuite } from '../../types';
import { FlowSuiteEditor } from './FlowSuiteEditor';

interface TestSuiteEditorProps {
  projectId: string;
  value?: TestSuite;
  isSaving: boolean;
  onSave: (value: { name: string; yamlContent?: string; visualFlow?: FlowSuiteDefinition }) => void;
  onDelete?: () => void;
  onBack: () => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type EditorMode = 'flow' | 'yaml';

export function TestSuiteEditor({ projectId, value, isSaving, onSave, onDelete, onBack, onMessage }: TestSuiteEditorProps) {
  const [name, setName] = useState(value?.name ?? 'Auth API');
  const [yaml, setYaml] = useState(value?.yaml ?? testSuiteExample);
  const [visualFlow, setVisualFlow] = useState<FlowSuiteDefinition | undefined>(() =>
    value ? value.visualFlow : createInitialFlow('Auth API'),
  );
  const [mode, setMode] = useState<EditorMode>(value && !value.visualFlow ? 'yaml' : 'flow');

  const validate = () => {
    const result = YamlValidator.validate(yaml);
    if (!result.ok) {
      onMessage(result.message, 'error');
      return false;
    }
    onMessage('YAML is valid', 'success');
    return true;
  };

  const startVisualFlow = () => {
    const nextFlow = createInitialFlow(name);
    setVisualFlow(nextFlow);
    setMode('flow');
  };

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Suite name</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="flex rounded-md border border-border bg-slate-50 p-1">
            <button
              type="button"
              className={`focus-ring rounded px-3 py-2 text-sm font-semibold ${mode === 'flow' ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
              onClick={() => (visualFlow ? setMode('flow') : startVisualFlow())}
            >
              Flow
            </button>
            <button
              type="button"
              className={`focus-ring rounded px-3 py-2 text-sm font-semibold ${mode === 'yaml' ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
              onClick={() => setMode('yaml')}
            >
              YAML
            </button>
          </div>
        </div>
      </section>

      {mode === 'flow' && visualFlow ? (
        <FlowSuiteEditor
          projectId={projectId}
          suiteName={name}
          initialFlow={visualFlow}
          initialYaml={yaml}
          onMessage={onMessage}
          onSave={(nextFlow) => {
            setVisualFlow(nextFlow);
            onSave({ name, visualFlow: nextFlow });
          }}
        />
      ) : (
        <>
          {!visualFlow ? (
            <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">This suite is YAML-only. You can keep editing YAML or create a new visual flow from scratch.</p>
                <Button type="button" variant="secondary" onClick={startVisualFlow}>Create visual flow</Button>
              </div>
            </section>
          ) : null}
          <YamlEditor label="Test suite YAML" value={yaml} onChange={setYaml} minRows={24} />
        </>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>Back to suites</Button>
        <div className="flex flex-wrap gap-3">
          {onDelete ? <Button type="button" variant="danger" onClick={onDelete}>Delete</Button> : null}
          {mode === 'yaml' ? <Button type="button" variant="secondary" onClick={validate}>Validate YAML</Button> : null}
          {mode === 'yaml' ? (
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (validate()) {
                  onSave({ name, yamlContent: yaml });
                }
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function createInitialFlow(suiteName: string): FlowSuiteDefinition {
  return {
    version: '1.0',
    suiteName,
    nodes: [
      {
        id: `api-${Date.now()}`,
        position: { x: 120, y: 120 },
        name: 'Health check',
        method: 'GET',
        path: '/health',
        expectStatus: 200,
      },
    ],
    edges: [],
  };
}
