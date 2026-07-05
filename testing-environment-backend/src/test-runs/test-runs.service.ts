import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RevisionStatus, TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ExecutionContextService } from '../observability/execution-context.service';
import { TracingService } from '../observability/tracing.service';
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
    private readonly executionContext: ExecutionContextService,
    private readonly tracing: TracingService,
  ) {}

  async create(projectId: string, companyId: string) {
    return this.tracing.span('http.create_test_run', { companyId, projectId }, async () => {
      this.executionContext.merge({ companyId, projectId });
      await this.projectAccess.getProjectOrThrow(projectId, companyId);
      await this.subscriptions.assertCanStartRun(projectId, companyId);
      const runId = randomUUID();
      this.executionContext.merge({ runId });
      const queueJobId = this.queue.getJobId(runId);
      const run = await this.prisma.$transaction(async (tx) => {
      const environmentConfig = await tx.environmentConfig.findUnique({
        where: { projectId },
        include: {
          revisions: {
            where: { status: RevisionStatus.PUBLISHED },
            orderBy: { revisionNumber: 'desc' },
            take: 1,
          },
        },
      });
      const environmentRevision = environmentConfig?.revisions[0];
      if (!environmentRevision) {
        throw new BadRequestException(
          'Published environment config revision is required before running tests',
        );
      }

      const suites = await tx.testSuite.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: {
          revisions: {
            where: { status: RevisionStatus.PUBLISHED },
            orderBy: { revisionNumber: 'desc' },
            take: 1,
          },
        },
      });
      if (suites.length === 0) {
        throw new BadRequestException(
          'At least one active test suite is required before running tests',
        );
      }
      const suitesWithoutPublishedRevision = suites.filter((suite) => suite.revisions.length === 0);
      if (suitesWithoutPublishedRevision.length > 0) {
        throw new BadRequestException(
          'All active test suites must have a published revision before running tests',
        );
      }

      return tx.testRun.create({
        data: {
          id: runId,
          projectId,
          status: TestRunStatus.CREATED,
          queueJobId,
          environmentConfigRevisionId: environmentRevision.id,
          runnerVersion: process.env.TEST_RUN_RUNNER_VERSION ?? 'local',
          reportSchemaVersion: 2,
          suiteRevisions: {
            create: suites.map((suite, position) => ({
              testSuiteId: suite.id,
              testSuiteRevisionId: suite.revisions[0].id,
              position,
              suiteName: suite.name,
            })),
          },
        },
      });
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
    });
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
      include: {
        results: true,
        environmentConfigRevision: true,
        suiteRevisions: {
          orderBy: { position: 'asc' },
          include: { testSuiteRevision: true },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    return run;
  }

  async cancel(
    projectId: string,
    runId: string,
    companyId: string,
    requestedBy?: string,
    reason?: string,
  ) {
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

    await this.state.requestCancel(runId, requestedBy, reason);
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
