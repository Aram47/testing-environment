import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testRunsApi } from '../test-runs.api';
import type { TestRun } from '../../types';

export function useTestRun(projectId: string, runId: string) {
  return useQuery({
    queryKey: ['test-runs', projectId, runId],
    queryFn: () => testRunsApi.get(projectId, runId),
    enabled: Boolean(projectId && runId),
  });
}

export function useTestRuns(projectId: string) {
  return useQuery({
    queryKey: ['test-runs', projectId],
    queryFn: () => testRunsApi.list(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateTestRun(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => testRunsApi.create(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] });
    },
  });
}

export function useCancelTestRun(projectId: string, runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => testRunsApi.cancel(projectId, runId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-runs', projectId, runId] });
    },
  });
}

export function invalidateTestRunQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  runId: string,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['test-runs', projectId, runId] }),
    queryClient.invalidateQueries({ queryKey: ['logs', projectId, runId] }),
  ]).then(() => undefined);
}

export type { TestRun };
