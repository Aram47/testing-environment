import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../api/projects.api';
import { ProjectForm } from '../forms/ProjectForm';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';
import type { CreateProjectInput } from '../types';

export function CreateProjectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: async (project) => {
      showToast('Project created', 'success');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${project.id}`);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  return (
    <>
      <PageHeader title="Create project" description="Define API identity and healthcheck defaults." />
      <ProjectForm isSubmitting={mutation.isPending} onSubmit={(value) => mutation.mutate(value)} />
    </>
  );
}
