import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { secretsApi } from '../../api/secrets.api';
import { ConfirmDialog } from '../../components/modals/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import type { SecretMetadata } from '../../types';

export function ProjectSecretsPanel({
  projectId,
  secrets,
  onMessage,
}: {
  projectId: string;
  secrets: SecretMetadata[];
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SecretMetadata | null>(null);

  const createMutation = useMutation({
    mutationFn: () => secretsApi.create(projectId, { key: key.trim(), value }),
    onSuccess: async () => {
      setKey('');
      setValue('');
      onMessage('Secret created', 'success');
      await queryClient.invalidateQueries({ queryKey: ['project-secrets', projectId] });
    },
    onError: (error) => onMessage(error instanceof Error ? error.message : 'Failed to create secret', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (secretId: string) => secretsApi.delete(projectId, secretId),
    onSuccess: async () => {
      onMessage('Secret deleted', 'success');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['project-secrets', projectId] });
    },
    onError: (error) => onMessage(error instanceof Error ? error.message : 'Failed to delete secret', 'error'),
  });

  return (
    <section className="panel space-y-4 p-4" aria-labelledby="project-secrets-title">
      <div>
        <h2 id="project-secrets-title" className="text-sm font-semibold text-ink">
          Project secrets
        </h2>
        <p className="text-sm text-muted">Secrets referenced in the visual environment editor.</p>
      </div>

      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!key.trim() || !value.trim()) {
            onMessage('Key and value are required', 'error');
            return;
          }
          createMutation.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Key</span>
          <input className="input w-full" value={key} onChange={(event) => setKey(event.target.value)} placeholder="DATABASE_URL" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Value</span>
          <input
            className="input w-full"
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Secret value"
            autoComplete="off"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving...' : 'Add secret'}
          </Button>
        </div>
      </form>

      {secrets.length === 0 ? (
        <p className="text-sm text-muted">No secrets yet. Add one to use secret references in service environment variables.</p>
      ) : (
        <ul className="space-y-2">
          {secrets.map((secret) => (
            <li key={secret.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-mono text-ink">{secret.key}</span>
              <Button type="button" variant="danger" onClick={() => setDeleteTarget(secret)}>
                <Trash2 size={16} /> Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete secret?"
        description={`Remove "${deleteTarget?.key}" from this project. References in the environment editor may break.`}
        confirmLabel="Delete secret"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
      />
    </section>
  );
}
