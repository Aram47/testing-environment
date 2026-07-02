import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { projectsApi } from '../api/projects.api';
import { environmentConfigsApi } from '../api/environment-configs.api';
import { testSuitesApi } from '../api/test-suites.api';
import { testRunsApi } from '../api/test-runs.api';
import { Button } from '../components/ui/Button';
import { LinkButton } from '../components/ui/LinkButton';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';

export function ProjectDetailsPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const projectQuery = useQuery({ queryKey: ['projects', projectId], queryFn: () => projectsApi.get(projectId) });
  const envQuery = useQuery({ queryKey: ['environment', projectId], queryFn: () => environmentConfigsApi.get(projectId), retry: false });
  const suitesQuery = useQuery({ queryKey: ['test-suites', projectId], queryFn: () => testSuitesApi.list(projectId) });
  const runsQuery = useQuery({ queryKey: ['test-runs', projectId], queryFn: () => testRunsApi.list(projectId) });
  const runMutation = useMutation({
    mutationFn: () => testRunsApi.create(projectId),
    onSuccess: async (run) => {
      showToast('Test run started', 'success');
      await queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] });
      navigate(`/projects/${projectId}/runs/${run.id}`);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (projectQuery.isLoading || suitesQuery.isLoading || runsQuery.isLoading) {
    return <LoadingState label="Loading project" />;
  }

  if (projectQuery.isError) {
    return <ErrorState error={projectQuery.error} />;
  }

  const project = projectQuery.data;
  if (!project) {
    return <ErrorState error={new Error('Project data is empty')} />;
  }
  const latestRun = runsQuery.data?.[0];

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description || project.baseUrl}
        action={
          <div className="flex flex-wrap gap-3">
            <LinkButton variant="secondary" to={`/projects/${projectId}/edit`}>Edit project</LinkButton>
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}><Play size={18} /> Run tests</Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Environment" value={envQuery.data?.isValid ? 'Valid' : envQuery.isError ? 'Missing' : 'Configured'} />
        <StatCard label="Test suites" value={suitesQuery.data?.length ?? 0} />
        <StatCard label="Latest result" value={latestRun?.status ?? 'No runs'} />
        <StatCard label="Base URL" value={project.baseUrl} />
      </div>
      <section className="mt-8 rounded-lg border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Project overview</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Action title="Environment configuration" to={`/projects/${projectId}/environment`} label="Configure Environment" />
          <Action title="YAML test suites" to={`/projects/${projectId}/test-suites`} label="Manage Test Suites" />
          <Action title="Reports" to={`/projects/${projectId}/runs`} label="View Reports" />
          <div className="rounded-md border border-border p-4">
            <p className="text-sm text-muted">Latest test run</p>
            <div className="mt-2"><StatusBadge status={latestRun?.status} /></div>
          </div>
        </div>
      </section>
    </>
  );
}

function Action({ title, to, label }: { title: string; to: string; label: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <LinkButton className="mt-4" variant="secondary" to={to}>{label}</LinkButton>
    </div>
  );
}
