import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { TestRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { ExecutionContextService } from '../observability/execution-context.service';
import { TracingService } from '../observability/tracing.service';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import {
  getTestRunJobId,
  TEST_RUN_JOB_NAME,
  TEST_RUN_QUEUE,
  TestRunJobData,
} from './queue.constants';

@Injectable()
export class TestRunQueueService {
  constructor(
    @InjectQueue(TEST_RUN_QUEUE) private readonly queue: Queue<TestRunJobData>,
    private readonly state: TestRunStateService,
    private readonly executionContext: ExecutionContextService,
    private readonly tracing: TracingService,
  ) {}

  getJobId(testRunId: string): string {
    return getTestRunJobId(testRunId);
  }

  async enqueue(testRunId: string): Promise<string> {
    return this.tracing.span('queue.enqueue_test_run', { runId: testRunId }, async () => {
      const jobId = this.getJobId(testRunId);
      const run = await this.state.getQueueState(testRunId);
      if (run.status !== TestRunStatus.CREATED) {
        return run.queueJobId ?? jobId;
      }

      await this.queue.add(
        TEST_RUN_JOB_NAME,
        {
          testRunId,
          context: this.executionContext.snapshot({ runId: testRunId, jobId }),
        },
        { jobId },
      );
      await this.state.markQueuedIfCreated(testRunId, jobId);
      return jobId;
    });
  }

  async hasJob(testRunId: string): Promise<boolean> {
    return Boolean(await this.queue.getJob(this.getJobId(testRunId)));
  }

  async restoreMissingQueuedJob(testRunId: string): Promise<string> {
    const jobId = this.getJobId(testRunId);
    const run = await this.state.getQueueState(testRunId);
    if (run.status !== TestRunStatus.QUEUED || run.finishedAt) {
      return run.queueJobId ?? jobId;
    }
    if (run.cancelRequestedAt || run.cancellationRequestedAt) {
      return run.queueJobId ?? jobId;
    }

    await this.queue.add(
      TEST_RUN_JOB_NAME,
      {
        testRunId,
        context: this.executionContext.snapshot({ runId: testRunId, jobId }),
      },
      { jobId },
    );
    return run.queueJobId ?? jobId;
  }

  async cancelQueuedRun(testRunId: string): Promise<'removed' | 'active' | 'missing'> {
    const job = await this.queue.getJob(this.getJobId(testRunId));
    if (!job) {
      return 'missing';
    }
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed' || state === 'prioritized') {
      await job.remove();
      return 'removed';
    }
    return 'active';
  }
}
