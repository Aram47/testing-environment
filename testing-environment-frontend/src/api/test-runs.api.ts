import { apiClient } from './client';
import type { TestRun } from '../types';
import { PaginatedResultAdapter, type PaginatedResult } from './paginated-result';

interface TestRunResponse extends Omit<TestRun, 'passed' | 'failed'> {
  passed?: number;
  failed?: number;
  passedTests?: number;
  failedTests?: number;
}

class TestRunsApi {
  async list(projectId: string): Promise<TestRun[]> {
    const { data } = await apiClient.get<TestRunResponse[] | PaginatedResult<TestRunResponse>>(`/projects/${projectId}/test-runs`);
    return PaginatedResultAdapter.toItems(data).map((run) => this.toTestRun(run));
  }

  async get(projectId: string, runId: string): Promise<TestRun> {
    const { data } = await apiClient.get<TestRunResponse>(`/projects/${projectId}/test-runs/${runId}`);
    return this.toTestRun(data);
  }

  async create(projectId: string): Promise<TestRun> {
    const { data } = await apiClient.post<TestRunResponse>(`/projects/${projectId}/test-runs`);
    return this.toTestRun(data);
  }

  async cancel(projectId: string, runId: string, reason?: string): Promise<TestRun> {
    const { data } = await apiClient.post<TestRunResponse>(
      `/projects/${projectId}/test-runs/${runId}/cancel`,
      reason ? { reason } : undefined,
    );
    return this.toTestRun(data);
  }

  private toTestRun(run: TestRunResponse): TestRun {
    return {
      ...run,
      passed: run.passed ?? run.passedTests ?? 0,
      failed: run.failed ?? run.failedTests ?? 0,
    };
  }
}

export const testRunsApi = new TestRunsApi();
