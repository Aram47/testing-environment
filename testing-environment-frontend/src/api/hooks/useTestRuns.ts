import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testRunsApi } from '../test-runs.api';
import type { RunStatus, TestRun, TestRunComparison, TestRunDetail } from '../../types';

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  'PASSED',
  'TEST_FAILED',
  'INFRA_FAILED',
  'TIMED_OUT',
  'CANCELLED',
]);

export function useTestRun(projectId: string, runId: string) {
  return useQuery({
    queryKey: ['test-runs', projectId, runId],
    queryFn: () => testRunsApi.get(projectId, runId),
    enabled: Boolean(projectId && runId),
  });
}

export function useTestRunDetail(projectId: string, runId: string) {
  return useQuery({
    queryKey: ['test-runs', projectId, runId, 'detail'],
    queryFn: () => testRunsApi.getDetail(projectId, runId),
    enabled: Boolean(projectId && runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL_STATUSES.has(status)) {
        return false;
      }
      return 2000;
    },
  });
}

export function useTestRunComparison(projectId: string, runId: string, enabled = true) {
  return useQuery({
    queryKey: ['test-runs', projectId, runId, 'comparison'],
    queryFn: () => testRunsApi.getComparison(projectId, runId),
    enabled: Boolean(projectId && runId && enabled),
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
    queryClient.invalidateQueries({ queryKey: ['test-runs', projectId, runId, 'detail'] }),
    queryClient.invalidateQueries({ queryKey: ['test-runs', projectId, runId, 'comparison'] }),
    queryClient.invalidateQueries({ queryKey: ['logs', projectId, runId] }),
  ]).then(() => undefined);
}

export type { TestRun, TestRunDetail, TestRunComparison };
