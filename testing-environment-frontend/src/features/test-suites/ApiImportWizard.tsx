import { useEffect, useMemo, useState } from 'react';
import { UploadCloud, Wand2 } from 'lucide-react';
import { testSuitesApi } from '../../api/test-suites.api';
import { Button } from '../../components/ui/Button';
import type {
  ApiImportSourceType,
  ApiImportTemplate,
  FlowSuiteDefinition,
  ImportPreviewResult,
  ImportWarning,
  ManualImportRequest,
} from '../../types';

interface ApiImportWizardProps {
  projectId: string;
  suiteName: string;
  onImported: (flow: FlowSuiteDefinition, yamlContent: string, warnings: ImportWarning[]) => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

const sourceTypes: ApiImportSourceType[] = ['OPENAPI', 'POSTMAN', 'BRUNO', 'CURL', 'MANUAL'];
const templateLabels: Record<ApiImportTemplate, string> = {
  SMOKE_TEST: 'Smoke test',
  AUTHENTICATED_JOURNEY: 'Authenticated journey',
  CRUD_LIFECYCLE: 'CRUD lifecycle',
  ASYNC_POLLING: 'Async polling',
  READINESS_TEST: 'Readiness test',
};
const destructiveMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function ApiImportWizard({ projectId, suiteName, onImported, onMessage }: ApiImportWizardProps) {
  const [sourceType, setSourceType] = useState<ApiImportSourceType>('OPENAPI');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<Record<string, string>>({});
  const [manualRequest, setManualRequest] = useState<ManualImportRequest>({
    name: 'Manual request',
    method: 'GET',
    path: '/health',
    headers: {},
    query: {},
    expectedStatus: 200,
  });
  const [manualBodyText, setManualBodyText] = useState('');
  const [manualBodyError, setManualBodyError] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResult>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [template, setTemplate] = useState<ApiImportTemplate>('SMOKE_TEST');
  const [acknowledgeDestructive, setAcknowledgeDestructive] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedOperations = useMemo(
    () => (preview?.operations ?? []).filter((operation) => selectedIds.includes(operation.id)),
    [preview, selectedIds],
  );
  const needsDestructiveAck = selectedOperations.some((operation) => destructiveMethods.has(operation.method.toUpperCase()));

  const previewImport = async () => {
    const body = parseManualBody();
    if (body.ok === false) {
      return;
    }
    setIsPreviewing(true);
    try {
      const nextPreview = await testSuitesApi.previewImport(projectId, {
        sourceType,
        content: sourceType === 'MANUAL' ? undefined : content,
        files: Object.keys(files).length > 0 ? files : undefined,
        manualRequest: sourceType === 'MANUAL' ? { ...manualRequest, body: body.value } : undefined,
      });
      setPreview(nextPreview);
      setSelectedIds(nextPreview.operations.map((operation) => operation.id));
      setTemplate(nextPreview.templates[0] ?? 'SMOKE_TEST');
      setAcknowledgeDestructive(false);
      onMessage(`Imported ${nextPreview.operations.length} operation(s) for review`, 'success');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Import preview failed', 'error');
    } finally {
      setIsPreviewing(false);
    }
  };

  const generateFlow = async () => {
    if (selectedOperations.length === 0) {
      onMessage('Select at least one imported operation', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const result = await testSuitesApi.generateImportedFlow(projectId, {
        suiteName,
        template,
        operations: selectedOperations,
        acknowledgeDestructive,
      });
      onImported(result.visualFlow, result.yamlContent, result.warnings);
      onMessage('Imported operations were converted to a draft flow', 'success');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Flow generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleOperation = (operationId: string) => {
    setSelectedIds((current) =>
      current.includes(operationId)
        ? current.filter((id) => id !== operationId)
        : [...current, operationId],
    );
  };

  const readFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      setFiles({});
      return;
    }
    const entries = await Promise.all(
      Array.from(fileList).map(async (file) => [file.name, await file.text()] as const),
    );
    setFiles(Object.fromEntries(entries));
    setContent('');
  };

  const parseManualBody = (): { ok: true; value?: unknown } | { ok: false } => {
    if (sourceType !== 'MANUAL' || !manualBodyText.trim()) {
      setManualBodyError('');
      return { ok: true, value: undefined };
    }
    try {
      const parsed = JSON.parse(manualBodyText);
      setManualBodyError('');
      return { ok: true, value: parsed };
    } catch {
      setManualBodyError('Manual request body must be valid JSON.');
      onMessage('Manual request body must be valid JSON', 'error');
      return { ok: false };
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Import API operations</h2>
          <p className="text-sm text-muted">Preview imported requests, choose operations, then generate a draft flow.</p>
        </div>
        <Button type="button" variant="secondary" disabled={isPreviewing} onClick={previewImport}>
          <UploadCloud size={16} /> {isPreviewing ? 'Previewing...' : 'Preview import'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {sourceTypes.map((source) => (
          <button
            key={source}
            type="button"
            className={`focus-ring min-h-11 rounded-md border px-3 text-sm font-semibold ${
              sourceType === source ? 'border-brand bg-brand text-white' : 'border-border text-ink'
            }`}
            onClick={() => {
              setSourceType(source);
              setPreview(undefined);
              setSelectedIds([]);
            }}
          >
            {source}
          </button>
        ))}
      </div>

      {sourceType === 'MANUAL' ? (
        <ManualRequestForm
          value={manualRequest}
          bodyText={manualBodyText}
          bodyError={manualBodyError}
          onChange={setManualRequest}
          onBodyTextChange={setManualBodyText}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Import content</span>
            <textarea
              className="input min-h-44 font-mono text-sm"
              spellCheck={false}
              value={content}
              placeholder="Paste OpenAPI, Postman collection, Bruno file, OpenCollection YAML, or cURL command."
              onChange={(event) => {
                setContent(event.target.value);
                setFiles({});
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Files</span>
            <input
              className="input"
              type="file"
              multiple={sourceType === 'BRUNO'}
              accept={sourceType === 'BRUNO' ? '.bru,.yaml,.yml' : '.json,.yaml,.yml,.txt'}
              onChange={(event) => {
                void readFiles(event.target.files);
              }}
            />
            <p className="mt-2 text-xs text-muted">
              {Object.keys(files).length > 0
                ? `${Object.keys(files).length} file(s) ready for preview.`
                : 'Paste content or choose files.'}
            </p>
          </label>
        </div>
      )}

      {preview ? (
        <div className="space-y-4">
          <ImportWarnings warnings={preview.warnings} />
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <OperationsList
              operations={preview.operations}
              selectedIds={selectedIds}
              onToggle={toggleOperation}
            />
            <section className="space-y-3 rounded-md border border-border p-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Template</span>
                <select className="input" value={template} onChange={(event) => setTemplate(event.target.value as ApiImportTemplate)}>
                  {preview.templates.map((item) => (
                    <option key={item} value={item}>
                      {templateLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              {preview.suggestedSecrets.length > 0 ? (
                <div className="rounded-md bg-slate-50 p-3 text-xs text-muted">
                  Suggested project secrets: {preview.suggestedSecrets.join(', ')}
                </div>
              ) : null}
              {needsDestructiveAck ? (
                <label className="flex min-h-11 items-start gap-2 text-sm font-medium text-ink">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={acknowledgeDestructive}
                    onChange={(event) => setAcknowledgeDestructive(event.target.checked)}
                  />
                  Generate selected destructive requests
                </label>
              ) : null}
              <Button
                type="button"
                className="w-full"
                disabled={isGenerating || selectedOperations.length === 0 || (needsDestructiveAck && !acknowledgeDestructive)}
                onClick={generateFlow}
              >
                <Wand2 size={16} /> {isGenerating ? 'Generating...' : 'Generate draft flow'}
              </Button>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ManualRequestForm({
  value,
  bodyText,
  bodyError,
  onChange,
  onBodyTextChange,
}: {
  value: ManualImportRequest;
  bodyText: string;
  bodyError: string;
  onChange: (value: ManualImportRequest) => void;
  onBodyTextChange: (value: string) => void;
}) {
  const update = (changes: Partial<ManualImportRequest>) => onChange({ ...value, ...changes });

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <TextField label="Name" value={value.name ?? ''} onChange={(name) => update({ name })} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Method</span>
        <select className="input" value={value.method} onChange={(event) => update({ method: event.target.value })}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Path or URL" value={value.path} onChange={(path) => update({ path })} />
      <TextField
        label="Expected status"
        type="number"
        value={String(value.expectedStatus ?? 200)}
        onChange={(expectedStatus) => update({ expectedStatus: Number(expectedStatus) })}
      />
      <KeyValueTextArea label="Headers JSON" value={value.headers} onChange={(headers) => update({ headers })} />
      <KeyValueTextArea label="Query JSON" value={value.query} onChange={(query) => update({ query })} />
      <label className="block lg:col-span-2">
        <span className="mb-1 block text-sm font-medium text-ink">JSON body</span>
        <textarea
          className="input min-h-28 font-mono text-sm"
          spellCheck={false}
          value={bodyText}
          onChange={(event) => onBodyTextChange(event.target.value)}
          placeholder={'{"name":"example"}'}
        />
        {bodyError ? <span className="mt-1 block text-xs font-medium text-red-600">{bodyError}</span> : null}
      </label>
    </div>
  );
}

function OperationsList({
  operations,
  selectedIds,
  onToggle,
}: {
  operations: ImportPreviewResult['operations'];
  selectedIds: string[];
  onToggle: (operationId: string) => void;
}) {
  if (operations.length === 0) {
    return <p className="rounded-md bg-slate-50 p-3 text-sm text-muted">No operations found.</p>;
  }

  return (
    <section className="space-y-2">
      {operations.map((operation) => (
        <label key={operation.id} className="flex gap-3 rounded-md border border-border p-3">
          <input
            className="mt-1"
            type="checkbox"
            checked={selectedIds.includes(operation.id)}
            onChange={() => onToggle(operation.id)}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              {operation.method} {operation.path}
            </span>
            <span className="block truncate text-sm text-muted">{operation.name}</span>
          </span>
        </label>
      ))}
    </section>
  );
}

function ImportWarnings({ warnings }: { warnings: ImportWarning[] }) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {warnings.map((warning, index) => (
        <p key={`${warning.code}-${warning.operationId ?? index}`}>{warning.message}</p>
      ))}
    </div>
  );
}

function TextField({ label, value, type = 'text', onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function KeyValueTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Record<string, string>;
  onChange: (value: Record<string, string> | undefined) => void;
}) {
  const [error, setError] = useState('');
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));

  useEffect(() => {
    setText(JSON.stringify(value ?? {}, null, 2));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <textarea
        className="input min-h-24 font-mono text-sm"
        spellCheck={false}
        value={text}
        onChange={(event) => {
          const nextText = event.target.value;
          setText(nextText);
          try {
            const parsed = JSON.parse(nextText || '{}') as unknown;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('Expected object');
            }
            onChange(Object.fromEntries(Object.entries(parsed).map(([key, entryValue]) => [key, String(entryValue)])));
            setError('');
          } catch {
            setError('Must be a JSON object.');
          }
        }}
      />
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}
