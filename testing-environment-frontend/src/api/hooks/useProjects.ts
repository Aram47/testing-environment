import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../projects.api';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => projectsApi.dashboard(),
  });
}
