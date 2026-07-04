import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { TestRunQueueService } from './test-run-queue.service';

@Injectable()
export class TestRunQueueRecoveryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TestRunQueueRecoveryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: TestRunQueueService,
    private readonly state: TestRunStateService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.recoverQueuedRuns();
    await this.recoverExpiredLeases();
    this.timer = setInterval(
      () => void this.recoverExpiredLeases(),
      this.config.get<number>('TEST_RUN_JANITOR_INTERVAL_MS', 30000),
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async recoverQueuedRuns(): Promise<void> {
    const recoverableRuns = await this.prisma.testRun.findMany({
      where: {
        status: { in: [TestRunStatus.CREATED, TestRunStatus.QUEUED] },
        finishedAt: null,
        cancelRequestedAt: null,
        cancellationRequestedAt: null,
      },
      select: { id: true },
    });

    for (const run of recoverableRuns) {
      try {
        await this.queue.enqueue(run.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to recover queued test run';
        this.logger.error(`Failed to recover test run ${run.id}: ${message}`);
      }
    }
  }

  private async recoverExpiredLeases(): Promise<void> {
    const now = new Date();
    const orphanedRuns = await this.prisma.testRun.findMany({
      where: {
        status: {
          in: [
            TestRunStatus.CLAIMED,
            TestRunStatus.PREPARING_WORKSPACE,
            TestRunStatus.VALIDATING_ENVIRONMENT,
            TestRunStatus.PULLING_IMAGES,
            TestRunStatus.STARTING_ENVIRONMENT,
            TestRunStatus.WAITING_FOR_HEALTHCHECK,
            TestRunStatus.EXECUTING_TESTS,
            TestRunStatus.COLLECTING_ARTIFACTS,
            TestRunStatus.CLEANING_UP,
            TestRunStatus.CANCEL_REQUESTED,
          ],
        },
        finishedAt: null,
        leaseExpiresAt: { lt: now },
      },
      select: { id: true, status: true },
    });

    for (const run of orphanedRuns) {
      try {
        if (run.status === TestRunStatus.CANCEL_REQUESTED) {
          await this.state.markCancelled(
            run.id,
            undefined,
            'Worker lease expired before cleanup confirmation',
          );
          continue;
        }

        await this.state.markInfraFailed(
          run.id,
          TestRunFailureCategory.INTERNAL,
          'Worker execution lease expired; run was not retried automatically',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to recover expired lease';
        this.logger.error(`Failed to recover expired lease for test run ${run.id}: ${message}`);
      }
    }
  }
}
