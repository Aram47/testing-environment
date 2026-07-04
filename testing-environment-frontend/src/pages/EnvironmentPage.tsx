import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { environmentConfigsApi } from '../api/environment-configs.api';
import type { EnvironmentRevisionCompareResult } from '../api/environment-configs.api';
import { EnvironmentEditor } from '../features/environment/EnvironmentEditor';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';
import type { EnvironmentConfig } from '../types';

export function EnvironmentPage() {
  const { projectId = '' } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
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
  const mutation = useMutation({
    mutationFn: (input: Omit<EnvironmentConfig, 'projectId'>) =>
      query.data ? environmentConfigsApi.update(projectId, input) : environmentConfigsApi.create(projectId, input),
    onSuccess: async () => {
      showToast('Configuration saved', 'success');
      await queryClient.invalidateQueries({ queryKey: ['environment', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['environment-revisions', projectId] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
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

  if (query.isLoading) {
    return <LoadingState label="Loading configuration" />;
  }

  if (query.isError && query.error && !query.data) {
    return (
      <>
        <PageHeader title="Environment configuration" description="Add Docker Compose and backend-test.yml configuration." />
        <EnvironmentEditor projectId={projectId} isSaving={mutation.isPending} onSave={(value) => mutation.mutate(value)} onMessage={showToast} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Environment configuration" description="Docker Compose, backend-test.yml, service settings, and healthcheck rules." />
      {query.isError ? <ErrorState error={query.error} /> : null}
      <EnvironmentEditor
        projectId={projectId}
        value={query.data}
        revisions={revisionsQuery.data ?? []}
        compareResult={compareMutation.data}
        isSaving={mutation.isPending}
        isPublishing={publishMutation.isPending}
        isComparing={compareMutation.isPending}
        onSave={(value) => mutation.mutate(value)}
        onPublish={(revisionId) => publishMutation.mutate(revisionId)}
        onCompare={(from, to) => compareMutation.mutate({ from, to })}
        onMessage={showToast}
      />
    </>
  );
}
