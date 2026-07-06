import type { TestRun, TestRunComparison, TestRunDetail } from '../types';
import { DEFAULT_LIST_LIMIT, PaginatedResultAdapter } from './paginated-result';
import { generatedApi } from './generated-client';
import type {
  CreateTestRunDto,
  TestRunDetailResponseDto,
  TestRunEventResponseDto,
  TestRunResponseDto,
} from '../generated/api';
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
      query: { page: 1, limit: DEFAULT_LIST_LIMIT },
    });
    return PaginatedResultAdapter.toItems(data).map((run) => this.toTestRun(run as TestRunResponse));
  }

  async get(projectId: string, runId: string): Promise<TestRun> {
    const data = await generatedApi.TestRunsController_find({
      path: { projectId, runId },
    }) as TestRunResponseDto;
    return this.toTestRun(data);
  }

  async getDetail(projectId: string, runId: string): Promise<TestRunDetail> {
    const data = await generatedApi.TestRunsController_findDetail({
      path: { projectId, runId },
    }) as TestRunDetailResponseDto;
    return this.toTestRunDetail(data);
  }

  async getComparison(projectId: string, runId: string): Promise<TestRunComparison> {
    return generatedApi.TestRunsController_findComparison({
      path: { projectId, runId },
    }) as Promise<TestRunComparison>;
  }

  async create(
    projectId: string,
    input?: { environmentConfigRevisionId?: string },
  ): Promise<TestRun> {
    const data = await generatedApi.TestRunsController_create(
      { path: { projectId } },
      (input ?? {}) as CreateTestRunDto,
    );
    return this.toTestRun(data);
  }

  async cancel(projectId: string, runId: string, reason?: string): Promise<TestRun> {
    const data = await generatedApi.TestRunsController_cancel(
      { path: { projectId, runId } },
      reason ? { reason } : {},
    ) as TestRunResponseDto;
    return this.toTestRun(data);
  }

  async events(projectId: string, runId: string, afterSequence: number): Promise<TestRunEvent[]> {
    const data = await generatedApi.TestRunsController_events({
      path: { projectId, runId },
      query: { afterSequence },
    }) as TestRunEventResponseDto[];
    return data.map((event) => this.toTestRunEvent(event));
  }

  async eventsAll(projectId: string, runId: string, afterSequence = 0): Promise<TestRunEvent[]> {
    const collected: TestRunEvent[] = [];
    let cursor = afterSequence;
    const pageSize = 500;

    while (true) {
      const page = await this.events(projectId, runId, cursor);
      if (!page.length) {
        break;
      }
      collected.push(...page);
      cursor = page[page.length - 1].sequence;
      if (page.length < pageSize) {
        break;
      }
    }

    return collected;
  }

  private toTestRunEvent(event: TestRunEventResponseDto): TestRunEvent {
    return {
      runId: event.runId,
      sequence: event.sequence,
      type: event.type,
      timestamp: event.timestamp,
      payload: event.payload,
    };
  }

  private toTestRun(run: TestRunResponse | TestRunResponseDto): TestRun {
    const revisionId = run.environmentConfigRevisionId;
    return {
      ...(run as TestRun),
      environmentConfigRevisionId:
        typeof revisionId === 'string' ? revisionId : undefined,
      passed: 'passed' in run ? (run.passed ?? run.passedTests ?? 0) : (run.passedTests ?? 0),
      failed: 'failed' in run ? (run.failed ?? run.failedTests ?? 0) : (run.failedTests ?? 0),
    };
  }

  private toTestRunDetail(run: TestRunDetailResponseDto): TestRunDetail {
    const base = this.toTestRun(run);
    return {
      ...base,
      environmentConfigRevision: run.environmentConfigRevision as TestRunDetail['environmentConfigRevision'],
      suiteRevisions: run.suiteRevisions as TestRunDetail['suiteRevisions'],
      results: run.results as TestRunDetail['results'],
      diagnosis: run.diagnosis as TestRunDetail['diagnosis'],
      phaseTimeline: run.phaseTimeline as TestRunDetail['phaseTimeline'],
    };
  }
}

export const testRunsApi = new TestRunsApi();
