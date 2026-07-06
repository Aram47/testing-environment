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
    return generatedApi.ReportsController_report({ path: { projectId, runId } });
  }

  async junit(projectId: string, runId: string): Promise<Blob> {
    return generatedApi.ReportsController_junit({ path: { projectId, runId } });
  }

  async artifact(projectId: string, runId: string, artifactId: string): Promise<Blob> {
    return generatedApi.ReportsController_downloadArtifact({
      path: { projectId, runId, artifactId },
    });
  }

  async logs(projectId: string, runId: string): Promise<RunnerLog[]> {
    const data = await generatedApi.ReportsController_logs({
      path: { projectId, runId },
    }) as RunnerLogResponse[];
    return data.map((log) => this.toRunnerLog(log));
  }

  async logChunks(projectId: string, runId: string, page = 1, limit = 100): Promise<PaginatedResult<RunnerLog>> {
    const data = await generatedApi.ReportsController_logChunks({
      path: { projectId, runId },
      query: { page, limit },
    }) as PaginatedResult<RunnerLogResponse>;
    return {
      data: PaginatedResultAdapter.toItems(data).map((log) => this.toRunnerLog(log)),
      meta: data.meta,
    };
  }

  private toRunnerLog(log: RunnerLogResponse): RunnerLog {
    return {
      id: log.id,
      timestamp: log.createdAt,
      source: log.source,
      level: this.toLevel(log.source),
      sequence: log.sequence,
      message: log.message,
      artifactId: log.artifactId,
      byteSize: log.byteSize,
      truncated: log.truncated,
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
