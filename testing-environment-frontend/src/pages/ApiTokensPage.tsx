import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiTokensApi, type ApiToken, type CreateApiTokenInput } from '../api/api-tokens.api';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';

const DEFAULT_SCOPES = ['project:read', 'run:read', 'run:write', 'environment:read'];

export function ApiTokensPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);
  const query = useQuery({ queryKey: ['api-tokens'], queryFn: apiTokensApi.list });

  const createMutation = useMutation({
    mutationFn: (input: CreateApiTokenInput) => apiTokensApi.create(input),
    onSuccess: async (result) => {
      setCreatedToken(result.token);
      setName('');
      showToast('API token created', 'success');
      await queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => apiTokensApi.revoke(tokenId),
    onSuccess: async () => {
      showToast('API token revoked', 'success');
      setRevokeTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (query.isLoading) {
    return <LoadingState label="Loading API tokens" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const tokens = query.data ?? [];

  return (
    <>
      <PageHeader title="API tokens" description="Create tokens for CI and automation." />
      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">Create token</h2>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              showToast('Token name is required', 'error');
              return;
            }
            createMutation.mutate({ name: name.trim(), scopes: DEFAULT_SCOPES });
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Name</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="CI pipeline" />
          </label>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create token'}
          </Button>
        </form>
        {createdToken ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Copy this token now. It will not be shown again.</p>
            <code className="mt-2 block break-all font-mono text-xs">{createdToken}</code>
          </div>
        ) : null}
      </section>
      <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Scopes</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{token.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{token.scopes.join(', ')}</td>
                <td className="px-4 py-3">{token.revokedAt ? 'Revoked' : 'Active'}</td>
                <td className="px-4 py-3">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={Boolean(token.revokedAt)}
                    onClick={() => setRevokeTarget(token)}
                  >
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke API token?"
        description={`Revoke "${revokeTarget?.name}". Integrations using it will stop working.`}
        confirmLabel="Revoke token"
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) {
            revokeMutation.mutate(revokeTarget.id);
          }
        }}
      />
    </>
  );
}
