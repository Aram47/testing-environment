import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsApi } from '../api/projects.api';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { ProjectForm } from '../forms/ProjectForm';
import { ErrorPresenter } from '../lib/errors';
import type { CreateProjectInput } from '../types';

export function EditProjectPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const query = useQuery({ queryKey: ['projects', projectId], queryFn: () => projectsApi.get(projectId) });
  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.update(projectId, input),
    onSuccess: async (project) => {
      showToast('Project updated', 'success');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      navigate(`/projects/${project.id}`);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (query.isLoading) {
    return <LoadingState label="Loading project" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const project = query.data;
  if (!project) {
    return <ErrorState error={new Error('Project data is empty')} />;
  }

  return (
    <>
      <PageHeader title="Edit project" description="Update API identity and healthcheck defaults." />
      <ProjectForm initialValue={project} isSubmitting={mutation.isPending} onSubmit={(value) => mutation.mutate(value)} />
    </>
  );
}
