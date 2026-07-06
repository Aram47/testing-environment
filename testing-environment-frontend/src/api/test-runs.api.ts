import { apiClient } from './client';
import type { TestRun } from '../types';
import { PaginatedResultAdapter, type PaginatedResult } from './paginated-result';
import { generatedApi } from './generated-client';
import type { TestRunEventResponseDto } from '../generated/api';
import type { TestRunEvent } from '../types';

interface TestRunResponse extends Omit<TestRun, 'passed' | 'failed'> {
  passed?: number;
  failed?: number;
  passedTests?: number;
  failedTests?: number;
}

class TestRunsApi {
  async list(projectId: string): Promise<TestRun[]> {
    const data = await generatedApi.TestRunsController_list({
      path: { projectId },
    }) as unknown as TestRunResponse[] | PaginatedResult<TestRunResponse>;
    return PaginatedResultAdapter.toItems(data).map((run) => this.toTestRun(run));
  }

  async get(projectId: string, runId: string): Promise<TestRun> {
    const data = await generatedApi.TestRunsController_find({
      path: { projectId, runId },
    }) as unknown as TestRunResponse;
    return this.toTestRun(data);
  }

  async create(projectId: string): Promise<TestRun> {
    const data = await generatedApi.TestRunsController_create({
      path: { projectId },
    }) as unknown as TestRunResponse;
    return this.toTestRun(data);
  }

  async cancel(projectId: string, runId: string, reason?: string): Promise<TestRun> {
    const data = await generatedApi.TestRunsController_cancel(
      { path: { projectId, runId } },
      reason ? { reason } : {},
    ) as unknown as TestRunResponse;
    return this.toTestRun(data);
  }

  async events(projectId: string, runId: string, afterSequence: number): Promise<TestRunEvent[]> {
    const data = await generatedApi.TestRunsController_events({
      path: { projectId, runId },
      query: { afterSequence },
    }) as TestRunEventResponseDto[];
    return data.map((event) => ({
      runId: event.runId,
      sequence: event.sequence,
      type: event.type,
      timestamp: event.timestamp,
      payload: event.payload,
    }));
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
