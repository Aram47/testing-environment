import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TestRunFailureCategory } from '@prisma/client';
import { ExecutionContextService } from '../observability/execution-context.service';
import { MetricsService } from '../observability/metrics.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { TracingService } from '../observability/tracing.service';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly prisma: PrismaService,
    private readonly executionContext: ExecutionContextService,
    private readonly metrics: MetricsService,
    private readonly structuredLogger: StructuredLoggerService,
    private readonly tracing: TracingService,
  ) {
    super();
  }

  async process(job: Job<TestRunJobData>): Promise<void> {
    const context = await this.resolveContext(job);
    const activeJobs = 1;
    const concurrency = Number.isFinite(workerConcurrency) && workerConcurrency > 0 ? workerConcurrency : 1;
    this.metrics.setRunnerSlots(activeJobs, Math.max(0, concurrency - activeJobs));
    try {
      await this.executionContext.run(context, () =>
        this.tracing.span('worker.claim_test_run', { runId: job.data.testRunId }, async () => {
          this.structuredLogger.event('worker.job.started');
          await this.orchestrator.execute(job.data.testRunId);
          this.structuredLogger.event('worker.job.completed');
        }),
      );
    } finally {
      this.metrics.setRunnerSlots(0, concurrency);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<TestRunJobData> | undefined, error: Error): Promise<void> {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) {
      return;
    }
    const message = error instanceof Error ? error.message : 'Runner worker failed';
    this.logger.error(`Test run job ${job.id ?? 'unknown'} failed: ${message}`);
    this.structuredLogger.eventError('worker.job.failed', error, {
      jobId: job.id,
      runId: job.data.testRunId,
    });
    await this.state
      .tryMarkInfraFailed(job.data.testRunId, TestRunFailureCategory.INTERNAL, message)
      .catch(() => undefined);
  }

  private async resolveContext(job: Job<TestRunJobData>) {
    const run = await this.prisma.testRun.findUnique({
      where: { id: job.data.testRunId },
      select: {
        id: true,
        projectId: true,
        runnerId: true,
        project: { select: { companyId: true } },
      },
    });
    return {
      ...job.data.context,
      runId: job.data.testRunId,
      jobId: String(job.id ?? ''),
      projectId: run?.projectId ?? job.data.context?.projectId,
      companyId: run?.project.companyId ?? job.data.context?.companyId,
      runnerId: run?.runnerId ?? job.data.context?.runnerId,
    };
  }
}
