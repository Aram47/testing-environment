import { useInfiniteQuery } from '@tanstack/react-query';
import { reportsApi } from '../reports.api';

const LOG_CHUNK_SIZE = 100;

export function useRunLogChunks(projectId: string, runId: string) {
  return useInfiniteQuery({
    queryKey: ['logs', projectId, runId, 'chunks'],
    queryFn: ({ pageParam }) => reportsApi.logChunks(projectId, runId, pageParam, LOG_CHUNK_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page >= lastPage.meta.totalPages) {
        return undefined;
      }
      return lastPage.meta.page + 1;
    },
    enabled: Boolean(projectId && runId),
  });
}
