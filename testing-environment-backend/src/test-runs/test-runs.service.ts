import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TestRunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunQueueService } from '../queue/test-run-queue.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class TestRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly subscriptions: SubscriptionsService,
    private readonly queue: TestRunQueueService,
  ) {}

  async create(projectId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    await this.subscriptions.assertCanStartRun(projectId, companyId);
    const runId = randomUUID();
    const queueJobId = this.queue.getJobId(runId);
    const run = await this.prisma.testRun.create({
      data: { id: runId, projectId, status: TestRunStatus.PENDING, queueJobId },
    });
    try {
      await this.queue.enqueue(run.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue test run';
      return this.prisma.testRun.update({
        where: { id: run.id },
        data: {
          status: TestRunStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: `Failed to enqueue test run: ${message}`,
        },
      });
    }
    return run;
  }

  async list(
    projectId: string,
    companyId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.TestRunWhereInput = { projectId };
    const [data, total] = await Promise.all([
      this.prisma.testRun.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.testRun.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async find(projectId: string, runId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const run = await this.prisma.testRun.findFirst({
      where: { id: runId, projectId },
      include: { results: true },
    });
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    return run;
  }

  async cancel(projectId: string, runId: string, companyId: string) {
    const run = await this.find(projectId, runId, companyId);
    if (
      run.status === TestRunStatus.PASSED ||
      run.status === TestRunStatus.FAILED ||
      run.status === TestRunStatus.CANCELLED
    ) {
      return run;
    }

    const cancellationRequestedAt = run.cancellationRequestedAt ?? new Date();
    if (run.status === TestRunStatus.PENDING) {
      const request = await this.prisma.testRun.updateMany({
        where: { id: runId, status: TestRunStatus.PENDING },
        data: { cancellationRequestedAt },
      });
      if (request.count === 0) {
        return this.find(projectId, runId, companyId);
      }
      const queueState = await this.queue.cancelQueuedRun(runId);
      if (queueState === 'removed' || queueState === 'missing') {
        await this.prisma.testRun.updateMany({
          where: { id: runId, status: TestRunStatus.PENDING },
          data: {
            status: TestRunStatus.CANCELLED,
            cancellationRequestedAt,
            finishedAt: new Date(),
          },
        });
        return this.find(projectId, runId, companyId);
      }
    }

    await this.prisma.testRun.updateMany({
      where: { id: runId, status: TestRunStatus.RUNNING },
      data: {
        cancellationRequestedAt,
      },
    });
    return this.find(projectId, runId, companyId);
  }
}
