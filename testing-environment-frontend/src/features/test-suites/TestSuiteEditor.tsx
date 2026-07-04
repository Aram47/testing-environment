import { useState } from 'react';
import { GitCompare, History, Rocket } from 'lucide-react';
import type { TestSuiteRevisionCompareResult } from '../../api/test-suites.api';
import { Button } from '../../components/ui/Button';
import { YamlEditor } from '../../editors/YamlEditor';
import { testSuiteExample } from '../../lib/examples';
import { YamlValidator } from '../../lib/yaml';
import type { FlowSuiteDefinition, TestSuite, TestSuiteRevision, TestSuiteSourceMode } from '../../types';
import { FlowSuiteEditor } from './FlowSuiteEditor';

interface TestSuiteEditorProps {
  projectId: string;
  value?: TestSuite;
  revisions?: TestSuiteRevision[];
  compareResult?: TestSuiteRevisionCompareResult;
  isSaving: boolean;
  isPublishing?: boolean;
  isComparing?: boolean;
  onSave: (value: { name: string; sourceMode: TestSuiteSourceMode; yamlContent?: string; visualFlow?: FlowSuiteDefinition }) => void;
  onPublish?: (revisionId: string) => void;
  onCompare?: (from: string, to: string) => void;
  onDelete?: () => void;
  onBack: () => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type EditorMode = 'flow' | 'yaml';

export function TestSuiteEditor({
  projectId,
  value,
  revisions = [],
  compareResult,
  isSaving,
  isPublishing = false,
  isComparing = false,
  onSave,
  onPublish,
  onCompare,
  onDelete,
  onBack,
  onMessage,
}: TestSuiteEditorProps) {
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
      {value ? (
        <RevisionPanel
          currentRevision={value.currentRevision}
          publishedRevision={value.publishedRevision}
          revisions={revisions}
          compareResult={compareResult}
          isPublishing={isPublishing}
          isComparing={isComparing}
          onPublish={onPublish}
          onCompare={onCompare}
        />
      ) : null}

      {mode === 'flow' && visualFlow ? (
        <FlowSuiteEditor
          projectId={projectId}
          suiteName={name}
          initialFlow={visualFlow}
          initialYaml={yaml}
          onMessage={onMessage}
          onSave={(nextFlow) => {
            setVisualFlow(nextFlow);
            onSave({ name, sourceMode: 'VISUAL', visualFlow: nextFlow });
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
                  onSave({ name, sourceMode: 'RAW_YAML', yamlContent: yaml });
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

function RevisionPanel({
  currentRevision,
  publishedRevision,
  revisions,
  compareResult,
  isPublishing,
  isComparing,
  onPublish,
  onCompare,
}: {
  currentRevision?: TestSuiteRevision;
  publishedRevision?: TestSuiteRevision;
  revisions: TestSuiteRevision[];
  compareResult?: TestSuiteRevisionCompareResult;
  isPublishing: boolean;
  isComparing: boolean;
  onPublish?: (revisionId: string) => void;
  onCompare?: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const canPublish = currentRevision?.status === 'DRAFT';
  const comparable = from && to && from !== to;

  return (
    <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Revision {currentRevision ? `#${currentRevision.revisionNumber}` : 'not saved'}</h2>
          <p className="text-sm text-muted">
            Current status: {currentRevision?.status ?? 'DRAFT'}.
            {publishedRevision ? ` Latest published: #${publishedRevision.revisionNumber}.` : ' No published revision yet.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
            <History size={16} /> Revision history
          </Button>
          {canPublish && currentRevision ? (
            <Button type="button" disabled={isPublishing} onClick={() => onPublish?.(currentRevision.id)}>
              <Rocket size={16} /> {isPublishing ? 'Publishing...' : 'Publish'}
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <RevisionSelect label="From" value={from} revisions={revisions} onChange={setFrom} />
            <RevisionSelect label="To" value={to} revisions={revisions} onChange={setTo} />
            <Button type="button" variant="secondary" disabled={!comparable || isComparing} onClick={() => onCompare?.(from, to)}>
              <GitCompare size={16} /> {isComparing ? 'Comparing...' : 'Compare'}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {revisions.map((revision) => (
              <article key={revision.id} className="rounded-md border border-border p-3 text-sm">
                <div className="font-semibold text-ink">Revision #{revision.revisionNumber}</div>
                <div className="text-muted">{revision.status} - {revision.sourceMode} - {formatDate(revision.createdAt)}</div>
              </article>
            ))}
          </div>
          {compareResult ? (
            <div className="rounded-md border border-border bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-ink">
                {`Diff #${compareResult.from.revisionNumber} -> #${compareResult.to.revisionNumber}`}
              </div>
              <div className="text-muted">
                {compareResult.diffs.compiledYaml.length === 0
                  ? 'No line changes.'
                  : `${compareResult.diffs.compiledYaml.length} changed line(s).`}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RevisionSelect({
  label,
  value,
  revisions,
  onChange,
}: {
  label: string;
  value: string;
  revisions: TestSuiteRevision[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select revision</option>
        {revisions.map((revision) => (
          <option key={revision.id} value={revision.id}>
            #{revision.revisionNumber} {revision.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Not published';
}

function createInitialFlow(suiteName: string): FlowSuiteDefinition {
  return {
    version: '1.1',
    suiteName,
    nodes: [
      {
        id: `api-${Date.now()}`,
        type: 'apiRequest',
        version: 'apiRequest/v1',
        position: { x: 120, y: 120 },
        name: 'Health check',
        method: 'GET',
        path: '/health',
        expectStatus: 200,
        timeoutMs: 30000,
        retryPolicy: { maxAttempts: 1, backoffMs: 0 },
        continueOnFailure: false,
      },
    ],
    edges: [],
  };
}
