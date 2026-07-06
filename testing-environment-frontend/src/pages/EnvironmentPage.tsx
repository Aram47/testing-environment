import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { environmentConfigsApi } from '../api/environment-configs.api';
import type { EnvironmentRevisionCompareResult } from '../api/environment-configs.api';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { EnvironmentEditor } from '../features/environment/EnvironmentEditor';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';
import type { EnvironmentConfig } from '../types';

interface VersionConflictDetails {
  currentRevisionId: string;
  currentRevisionNumber: number;
}

function extractConflictDetails(error: unknown): VersionConflictDetails | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return null;
  }
  const payload = error.response.data as {
    message?: string | { currentRevisionId?: string; currentRevisionNumber?: number };
  };
  if (payload.message && typeof payload.message === 'object') {
    if (payload.message.currentRevisionId && payload.message.currentRevisionNumber) {
      return {
        currentRevisionId: payload.message.currentRevisionId,
        currentRevisionNumber: payload.message.currentRevisionNumber,
      };
    }
  }
  return null;
}

export function EnvironmentPage() {
  const { projectId = '' } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [conflict, setConflict] = useState<VersionConflictDetails | null>(null);
  const [pendingSave, setPendingSave] = useState<
    (Omit<EnvironmentConfig, 'projectId'> & { baseRevisionId?: string }) | null
  >(null);

  const query = useQuery({
    queryKey: ['environment', projectId],
    queryFn: () => environmentConfigsApi.get(projectId),
    retry: false,
  });
  const revisionsQuery = useQuery({
    queryKey: ['environment-revisions', projectId],
    queryFn: () => environmentConfigsApi.revisions(projectId),
    enabled: Boolean(query.data),
  });

  const saveMutation = useMutation({
    mutationFn: (input: Omit<EnvironmentConfig, 'projectId'> & { baseRevisionId?: string }) =>
      query.data
        ? environmentConfigsApi.update(projectId, input)
        : environmentConfigsApi.create(projectId, input),
    onSuccess: async () => {
      showToast('Configuration saved', 'success');
      setPendingSave(null);
      setConflict(null);
      await queryClient.invalidateQueries({ queryKey: ['environment', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['environment-revisions', projectId] });
    },
    onError: (error, variables) => {
      const details = extractConflictDetails(error);
      if (details) {
        setConflict(details);
        setPendingSave(variables);
        return;
      }
      showToast(ErrorPresenter.message(error), 'error');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (revisionId: string) => environmentConfigsApi.publish(projectId, revisionId),
    onSuccess: async () => {
      showToast('Revision published', 'success');
      await queryClient.invalidateQueries({ queryKey: ['environment', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['environment-revisions', projectId] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  const compareMutation = useMutation<EnvironmentRevisionCompareResult, Error, { from: string; to: string }>({
    mutationFn: ({ from, to }) => environmentConfigsApi.compare(projectId, from, to),
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  const handleSave = (value: Omit<EnvironmentConfig, 'projectId'> & { baseRevisionId?: string }) => {
    if (saveMutation.isPending) {
      return;
    }
    saveMutation.mutate(value);
  };

  const reloadAfterConflict = async () => {
    setConflict(null);
    setPendingSave(null);
    await queryClient.invalidateQueries({ queryKey: ['environment', projectId] });
    await queryClient.invalidateQueries({ queryKey: ['environment-revisions', projectId] });
    showToast('Loaded the latest server revision', 'info');
  };

  const saveDespiteConflict = () => {
    if (!pendingSave) {
      return;
    }
    const payload = { ...pendingSave };
    delete payload.baseRevisionId;
    saveMutation.mutate(payload);
    setConflict(null);
  };

  if (query.isLoading) {
    return <LoadingState label="Loading configuration" />;
  }

  return (
    <>
      <PageHeader
        title="Environment configuration"
        description="Docker Compose, backend-test.yml, service settings, and healthcheck rules."
      />
      {query.isError && query.error && !query.data ? (
        <EnvironmentEditor
          projectId={projectId}
          isSaving={saveMutation.isPending}
          onSave={handleSave}
          onMessage={showToast}
        />
      ) : (
        <>
          {query.isError ? <ErrorState error={query.error} /> : null}
          <EnvironmentEditor
            projectId={projectId}
            value={query.data}
            revisions={revisionsQuery.data ?? []}
            compareResult={compareMutation.data}
            isSaving={saveMutation.isPending}
            isPublishing={publishMutation.isPending}
            isComparing={compareMutation.isPending}
            onSave={handleSave}
            onPublish={(revisionId) => publishMutation.mutate(revisionId)}
            onCompare={(from, to) => compareMutation.mutate({ from, to })}
            onMessage={showToast}
          />
        </>
      )}
      <ConfirmDialog
        open={Boolean(conflict)}
        title="Configuration changed elsewhere"
        description={
          conflict
            ? `Another save created revision #${conflict.currentRevisionNumber}. Reload the latest version or save your changes as a new draft revision.`
            : ''
        }
        confirmLabel="Save as new draft"
        onCancel={reloadAfterConflict}
        onConfirm={saveDespiteConflict}
      />
    </>
  );
}
