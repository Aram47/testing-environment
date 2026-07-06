import { apiClient } from './client';
import type { RunnerLog } from '../types';
import { PaginatedResultAdapter, type PaginatedResult } from './paginated-result';
import { generatedApi } from './generated-client';

interface RunnerLogResponse {
  id: string;
  source: 'SYSTEM' | 'DOCKER' | 'TEST' | 'ERROR';
  sequence?: number;
  message: string;
  createdAt: string;
  artifactId?: string;
  byteSize?: number;
  truncated?: boolean;
}

class ReportsApi {
  async report(projectId: string, runId: string): Promise<Blob> {
    const { data } = await apiClient.get<Blob>(`/projects/${projectId}/test-runs/${runId}/report`, {
      responseType: 'blob',
    });
    return data;
  }

  async junit(projectId: string, runId: string): Promise<Blob> {
    const { data } = await apiClient.get<Blob>(`/projects/${projectId}/test-runs/${runId}/report/junit`, {
      responseType: 'blob',
    });
    return data;
  }

  async artifact(projectId: string, runId: string, artifactId: string): Promise<Blob> {
    const { data } = await apiClient.get<Blob>(
      `/projects/${projectId}/test-runs/${runId}/artifacts/${artifactId}/download`,
      { responseType: 'blob' },
    );
    return data;
  }

  async logs(projectId: string, runId: string): Promise<RunnerLog[]> {
    const { data } = await apiClient.get<RunnerLogResponse[]>(`/projects/${projectId}/test-runs/${runId}/logs`);
    return data.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      level: this.toLevel(log.source),
      sequence: log.sequence,
      message: log.message,
      artifactId: log.artifactId,
      byteSize: log.byteSize,
      truncated: log.truncated,
    }));
  }

  async logChunks(projectId: string, runId: string, page = 1, limit = 100): Promise<PaginatedResult<RunnerLog>> {
    const data = await generatedApi.ReportsController_logChunks({
      path: { projectId, runId },
      query: { page, limit },
    }) as unknown as PaginatedResult<RunnerLogResponse>;
    return {
      data: PaginatedResultAdapter.toItems(data).map((log) => ({
        id: log.id,
        timestamp: log.createdAt,
        level: this.toLevel(log.source),
        sequence: log.sequence,
        message: log.message,
        artifactId: log.artifactId,
        byteSize: log.byteSize,
        truncated: log.truncated,
      })),
      meta: data.meta,
    };
  }

  private toLevel(source: RunnerLogResponse['source']): RunnerLog['level'] {
    if (source === 'ERROR') {
      return 'error';
    }
    if (source === 'DOCKER') {
      return 'debug';
    }
    return 'info';
  }
}

export const reportsApi = new ReportsApi();
