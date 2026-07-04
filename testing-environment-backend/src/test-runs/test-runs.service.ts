import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunQueueService } from '../queue/test-run-queue.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TestRunStateService } from './test-run-state.service';

@Injectable()
export class TestRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly subscriptions: SubscriptionsService,
    private readonly queue: TestRunQueueService,
    private readonly state: TestRunStateService,
  ) {}

  async create(projectId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    await this.subscriptions.assertCanStartRun(projectId, companyId);
    const runId = randomUUID();
    const queueJobId = this.queue.getJobId(runId);
    const run = await this.prisma.testRun.create({
      data: { id: runId, projectId, status: TestRunStatus.CREATED, queueJobId },
    });
    try {
      await this.queue.enqueue(run.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue test run';
      return this.state.markInfraFailed(
        run.id,
        TestRunFailureCategory.INTERNAL,
        `Failed to enqueue test run: ${message}`,
      );
    }
    return this.find(projectId, run.id, companyId);
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
    if (this.state.isTerminal(run.status)) {
      return run;
    }

    if (run.status === TestRunStatus.CANCEL_REQUESTED) {
      return run;
    }

    if (!this.state.cancellableStatuses.includes(run.status)) {
      return run;
    }

    await this.state.requestCancel(runId);
    if (run.status === TestRunStatus.QUEUED) {
      const queueState = await this.queue.cancelQueuedRun(runId);
      if (queueState === 'removed' || queueState === 'missing') {
        await this.state.markCancelled(runId);
        return this.find(projectId, runId, companyId);
      }
    }

    return this.find(projectId, runId, companyId);
  }
}
