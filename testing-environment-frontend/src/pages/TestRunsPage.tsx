import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { testRunsApi } from '../api/test-runs.api';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { TestRunsTable } from '../tables/TestRunsTable';
import { ErrorPresenter } from '../lib/errors';

export function TestRunsPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const query = useQuery({ queryKey: ['test-runs', projectId], queryFn: () => testRunsApi.list(projectId) });
  const runMutation = useMutation({
    mutationFn: () => testRunsApi.create(projectId),
    onSuccess: async (run) => {
      showToast('Test run started', 'success');
      await queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] });
      navigate(`/projects/${projectId}/runs/${run.id}`);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (query.isLoading) {
    return <LoadingState label="Loading runs" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  return (
    <>
      <PageHeader
        title="Test runs"
        description="Execution history with status, duration, and report links."
        action={<Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}><Play size={18} /> Run tests</Button>}
      />
      {!query.data?.length ? (
        <EmptyState title="No runs yet" description="Run configured suites to generate reports and logs." />
      ) : (
        <TestRunsTable projectId={projectId} runs={query.data} />
      )}
    </>
  );
}
