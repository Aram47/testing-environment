import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { environmentConfigsApi } from '../../api/environment-configs.api';
import { ConfirmDialog } from '../../components/modals/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import type { EnvironmentConfigRevision } from '../../types';

export function DryRunPanel({
  projectId,
  revisionId,
  disabled,
  onMessage,
}: {
  projectId: string;
  revisionId?: string;
  disabled?: boolean;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const queryClient = useQueryClient();
  const [activeDryRunId, setActiveDryRunId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const historyQuery = useQuery({
    queryKey: ['environment-dry-runs', projectId],
    queryFn: () => environmentConfigsApi.listDryRuns(projectId),
  });

  const activeQuery = useQuery({
    queryKey: ['environment-dry-run', projectId, activeDryRunId],
    queryFn: () => environmentConfigsApi.getDryRun(projectId, activeDryRunId!),
    enabled: Boolean(activeDryRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || ['PASSED', 'INFRA_FAILED', 'CANCELLED', 'TIMED_OUT'].includes(status)) {
        return false;
      }
      return 2000;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => environmentConfigsApi.createDryRun(projectId, revisionId!),
    onSuccess: async (dryRun) => {
      setActiveDryRunId(dryRun.id);
      onMessage('Environment dry run started', 'info');
      await queryClient.invalidateQueries({ queryKey: ['environment-dry-runs', projectId] });
    },
    onError: (error) => onMessage(error instanceof Error ? error.message : 'Dry run failed', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => environmentConfigsApi.cancelDryRun(projectId, activeDryRunId!),
    onSuccess: async () => {
      onMessage('Dry run cancellation requested', 'info');
      await queryClient.invalidateQueries({ queryKey: ['environment-dry-runs', projectId] });
      setCancelOpen(false);
    },
    onError: (error) => onMessage(error instanceof Error ? error.message : 'Cancel failed', 'error'),
  });

  useEffect(() => {
    if (activeQuery.data?.status && ['PASSED', 'INFRA_FAILED', 'CANCELLED', 'TIMED_OUT'].includes(activeQuery.data.status)) {
      queryClient.invalidateQueries({ queryKey: ['environment-dry-runs', projectId] });
    }
  }, [activeQuery.data?.status, projectId, queryClient]);

  return (
    <section className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Environment dry run</h2>
          <p className="text-sm text-muted">Start environment, wait for healthcheck, collect logs, then stop.</p>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            disabled={disabled || !revisionId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Play size={16} /> {createMutation.isPending ? 'Starting...' : 'Dry run'}
          </Button>
          {activeDryRunId ? (
            <Button type="button" variant="danger" onClick={() => setCancelOpen(true)}>
              <Square size={16} /> Stop
            </Button>
          ) : null}
        </div>
      </div>

      {activeQuery.data ? (
        <div className="rounded-md border border-border bg-page p-3 text-sm">
          <div className="font-semibold text-ink">Status: {activeQuery.data.status}</div>
          {activeQuery.data.errorMessage ? <p className="text-red-700">{activeQuery.data.errorMessage}</p> : null}
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-ink">
            {(activeQuery.data.logs ?? []).map((log) => `[${log.source}] ${log.message}`).join('\n') ||
              'Waiting for logs...'}
          </pre>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-muted">Recent dry runs</h3>
        {(historyQuery.data ?? []).slice(0, 5).map((dryRun) => (
          <DryRunHistoryItem
            key={dryRun.id}
            dryRun={dryRun}
            onSelect={() => setActiveDryRunId(dryRun.id)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Stop environment dry run?"
        description="This requests cancellation and cleanup of the running environment."
        confirmLabel="Stop dry run"
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
      />
    </section>
  );
}

function DryRunHistoryItem({
  dryRun,
  onSelect,
}: {
  dryRun: { id: string; status: string; environmentConfigRevision?: EnvironmentConfigRevision };
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="focus-ring flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm"
      onClick={onSelect}
    >
      <span>
        Revision #{dryRun.environmentConfigRevision?.revisionNumber ?? '?'} - {dryRun.status}
      </span>
    </button>
  );
}
