import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TestRunFailureCategory } from '@prisma/client';
import { TEST_RUN_QUEUE, TestRunJobData } from '../queue/queue.constants';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { RunnerOrchestratorService } from './runner-orchestrator.service';

const workerConcurrency = Number(process.env.TEST_RUN_QUEUE_CONCURRENCY ?? 1);

export function resolveWorkerMaxStalledCount(value?: string): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

@Injectable()
@Processor(TEST_RUN_QUEUE, {
  concurrency: Number.isFinite(workerConcurrency) && workerConcurrency > 0 ? workerConcurrency : 1,
  stalledInterval: Number(process.env.TEST_RUN_STALLED_INTERVAL_MS ?? 30000),
  maxStalledCount: resolveWorkerMaxStalledCount(process.env.TEST_RUN_MAX_STALLED_COUNT),
})
export class TestRunWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(TestRunWorkerProcessor.name);

  constructor(
    private readonly orchestrator: RunnerOrchestratorService,
    private readonly state: TestRunStateService,
  ) {
    super();
  }

  async process(job: Job<TestRunJobData>): Promise<void> {
    await this.orchestrator.execute(job.data.testRunId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<TestRunJobData> | undefined, error: Error): Promise<void> {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) {
      return;
    }
    const message = error instanceof Error ? error.message : 'Runner worker failed';
    this.logger.error(`Test run job ${job.id ?? 'unknown'} failed: ${message}`);
    await this.state
      .tryMarkInfraFailed(job.data.testRunId, TestRunFailureCategory.INTERNAL, message)
      .catch(() => undefined);
  }
}
