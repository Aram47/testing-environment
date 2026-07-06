import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { EnvironmentDryRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { ExecutionContextService } from '../observability/execution-context.service';
import { TracingService } from '../observability/tracing.service';
import { EnvironmentDryRunStateService } from '../environment-configs/environment-dry-run-state.service';
import {
  ENVIRONMENT_DRY_RUN_JOB_NAME,
  EnvironmentDryRunJobData,
  getEnvironmentDryRunJobId,
  TEST_RUN_QUEUE,
} from './queue.constants';

@Injectable()
export class EnvironmentDryRunQueueService {
  constructor(
    @InjectQueue(TEST_RUN_QUEUE) private readonly queue: Queue<EnvironmentDryRunJobData>,
    private readonly state: EnvironmentDryRunStateService,
    private readonly executionContext: ExecutionContextService,
    private readonly tracing: TracingService,
  ) {}

  getJobId(dryRunId: string): string {
    return getEnvironmentDryRunJobId(dryRunId);
  }

  async enqueue(dryRunId: string): Promise<string> {
    return this.tracing.span('queue.enqueue_environment_dry_run', { dryRunId }, async () => {
      const jobId = this.getJobId(dryRunId);
      const dryRun = await this.state.getById(dryRunId);
      if (dryRun.status !== EnvironmentDryRunStatus.CREATED) {
        return dryRun.queueJobId ?? jobId;
      }

      await this.queue.add(
        ENVIRONMENT_DRY_RUN_JOB_NAME,
        {
          dryRunId,
          context: this.executionContext.snapshot({ jobId }),
        },
        { jobId },
      );
      await this.state.markQueued(dryRunId, jobId);
      return jobId;
    });
  }

  async cancelQueuedRun(dryRunId: string): Promise<'removed' | 'active' | 'missing'> {
    const job = await this.queue.getJob(this.getJobId(dryRunId));
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
