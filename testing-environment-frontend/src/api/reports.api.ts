import { apiClient } from './client';
import type { RunnerLog } from '../types';

interface RunnerLogResponse {
  id: string;
  source: 'SYSTEM' | 'DOCKER' | 'TEST' | 'ERROR';
  message: string;
  createdAt: string;
}

class ReportsApi {
  async report(projectId: string, runId: string): Promise<Blob> {
    const { data } = await apiClient.get<Blob>(`/projects/${projectId}/test-runs/${runId}/report`, {
      responseType: 'blob',
    });
    return data;
  }

  async logs(projectId: string, runId: string): Promise<RunnerLog[]> {
    const { data } = await apiClient.get<RunnerLogResponse[]>(`/projects/${projectId}/test-runs/${runId}/logs`);
    return data.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      level: this.toLevel(log.source),
      message: log.message,
    }));
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
