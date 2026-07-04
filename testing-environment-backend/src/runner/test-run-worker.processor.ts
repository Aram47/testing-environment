import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TEST_RUN_QUEUE, TestRunJobData } from '../queue/queue.constants';
import { RunnerOrchestratorService } from './runner-orchestrator.service';

const workerConcurrency = Number(process.env.TEST_RUN_QUEUE_CONCURRENCY ?? 1);

@Injectable()
@Processor(TEST_RUN_QUEUE, {
  concurrency: Number.isFinite(workerConcurrency) && workerConcurrency > 0 ? workerConcurrency : 1,
  stalledInterval: Number(process.env.TEST_RUN_STALLED_INTERVAL_MS ?? 30000),
  maxStalledCount: Number(process.env.TEST_RUN_MAX_STALLED_COUNT ?? 1),
})
export class TestRunWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(TestRunWorkerProcessor.name);

  constructor(
    private readonly orchestrator: RunnerOrchestratorService,
    private readonly prisma: PrismaService,
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
    await this.prisma.testRun.updateMany({
      where: {
        id: job.data.testRunId,
        status: { in: [TestRunStatus.PENDING, TestRunStatus.RUNNING] },
      },
      data: {
        status: TestRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
  }
}
