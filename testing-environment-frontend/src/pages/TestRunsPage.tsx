import { useNavigate, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useCreateTestRun, useTestRuns } from '../api/hooks/useTestRuns';
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
  const { showToast } = useToast();
  const query = useTestRuns(projectId);
  const runMutation = useCreateTestRun(projectId);

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
        action={
          <Button
            onClick={() => runMutation.mutate(undefined, {
              onSuccess: (run) => {
                showToast('Test run started', 'success');
                navigate(`/projects/${projectId}/runs/${run.id}`);
              },
              onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
            })}
            disabled={runMutation.isPending}
          >
            <Play size={18} /> Run tests
          </Button>
        }
      />
      {!query.data?.length ? (
        <EmptyState title="No runs yet" description="Run configured suites to generate reports and logs." />
      ) : (
        <TestRunsTable projectId={projectId} runs={query.data} />
      )}
    </>
  );
}
