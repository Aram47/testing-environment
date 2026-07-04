import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunQueueService } from './test-run-queue.service';

@Injectable()
export class TestRunQueueRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TestRunQueueRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: TestRunQueueService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const recoverableRuns = await this.prisma.testRun.findMany({
      where: {
        status: { in: [TestRunStatus.CREATED, TestRunStatus.QUEUED] },
        finishedAt: null,
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
}
