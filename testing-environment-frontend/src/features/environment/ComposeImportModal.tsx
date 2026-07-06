import { useState } from 'react';
import { Upload } from 'lucide-react';
import { environmentConfigsApi } from '../../api/environment-configs.api';
import { Button } from '../../components/ui/Button';

export function ComposeImportModal({
  projectId,
  open,
  onClose,
  onImported,
  onMessage,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onImported: (result: Awaited<ReturnType<typeof environmentConfigsApi.importCompose>>) => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [composeYaml, setComposeYaml] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [unsupportedFields, setUnsupportedFields] = useState<string[]>([]);

  if (!open) {
    return null;
  }

  const importCompose = async (source: 'paste' | 'upload') => {
    if (!composeYaml.trim()) {
      onMessage('Paste or upload Docker Compose YAML first', 'error');
      return;
    }
    setIsImporting(true);
    setUnsupportedFields([]);
    try {
      const result = await environmentConfigsApi.importCompose(projectId, {
        composeYaml,
        source,
      });
      setUnsupportedFields(result.unsupportedFields);
      onImported(result);
      onMessage('Compose imported into visual editor', 'success');
      if (result.unsupportedFields.length === 0) {
        onClose();
      }
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Compose import failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <section className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-soft" role="dialog" aria-modal="true">
        <h2 className="text-lg font-semibold text-ink">Import Docker Compose</h2>
        <p className="mt-2 text-sm text-muted">Paste or upload compose YAML to populate the visual editor.</p>
        <textarea
          className="input mt-4 min-h-48 w-full font-mono text-sm"
          value={composeYaml}
          onChange={(event) => setComposeYaml(event.target.value)}
          placeholder="services: ..."
        />
        <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
          <Upload size={16} />
          Upload file
          <input
            type="file"
            accept=".yml,.yaml,text/yaml"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              setComposeYaml(await file.text());
            }}
          />
        </label>
        {unsupportedFields.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Some compose fields are not editable in visual mode:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {unsupportedFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isImporting} onClick={() => importCompose('paste')}>
            {isImporting ? 'Importing...' : 'Import compose'}
          </Button>
        </div>
      </section>
    </div>
  );
}
