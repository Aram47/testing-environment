import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { TestRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
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
  ) {}

  getJobId(testRunId: string): string {
    return getTestRunJobId(testRunId);
  }

  async enqueue(testRunId: string): Promise<string> {
    const jobId = this.getJobId(testRunId);
    const run = await this.state.getQueueState(testRunId);
    if (run.status !== TestRunStatus.CREATED) {
      return run.queueJobId ?? jobId;
    }

    await this.queue.add(TEST_RUN_JOB_NAME, { testRunId }, { jobId });
    await this.state.markQueuedIfCreated(testRunId, jobId);
    return jobId;
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

    await this.queue.add(TEST_RUN_JOB_NAME, { testRunId }, { jobId });
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
