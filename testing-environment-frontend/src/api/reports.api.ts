import { apiClient } from './client';
import type { RunnerLog } from '../types';

interface RunnerLogResponse {
  id: string;
  source: 'SYSTEM' | 'DOCKER' | 'TEST' | 'ERROR';
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
      message: log.message,
      artifactId: log.artifactId,
      byteSize: log.byteSize,
      truncated: log.truncated,
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
