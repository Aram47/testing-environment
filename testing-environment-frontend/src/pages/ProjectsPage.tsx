import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { projectsApi } from '../api/projects.api';
import { Button } from '../components/ui/Button';
import { LinkButton } from '../components/ui/LinkButton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';
import { Format } from '../lib/format';
import type { Project } from '../types';

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const query = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: async () => {
      showToast('Project deleted', 'success');
      setProjectToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (query.isLoading) {
    return <LoadingState label="Loading projects" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const projects = query.data;
  if (!projects) {
    return <ErrorState error={new Error('Projects data is empty')} />;
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Backend applications and their test environment configuration."
        action={<LinkButton to="/projects/new">New project</LinkButton>}
      />
      {!projects.length ? (
        <EmptyState
          title="No projects yet"
          description="Create the first backend project to add Docker Compose config and YAML suites."
          action={<LinkButton to="/projects/new">Create project</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <article key={project.id} className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
                  <p className="mt-1 text-sm text-muted">{project.description || project.baseUrl}</p>
                </div>
                <StatusBadge status={project.lastRunStatus} />
              </div>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Base URL" value={project.baseUrl} />
                <Info label="Created" value={Format.date(project.createdAt)} />
              </dl>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <LinkButton variant="secondary" to={`/projects/${project.id}`}>Open</LinkButton>
                <LinkButton variant="secondary" to={`/projects/${project.id}/edit`}>Edit</LinkButton>
                <Button variant="danger" onClick={() => setProjectToDelete(project)}>
                  <Trash2 aria-hidden="true" size={16} /> Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(projectToDelete)}
        title="Delete project"
        description={`Delete ${projectToDelete?.name ?? 'this project'} and its test configuration? This action cannot be undone.`}
        confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={() => projectToDelete && deleteMutation.mutate(projectToDelete.id)}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-1 break-words font-medium text-ink">{value}</dd>
    </div>
  );
}
