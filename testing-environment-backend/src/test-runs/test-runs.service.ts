import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TestRunStatus } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { RunnerOrchestratorService } from '../runner/runner-orchestrator.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class TestRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly subscriptions: SubscriptionsService,
    private readonly runner: RunnerOrchestratorService,
  ) {}

  async create(projectId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    await this.subscriptions.assertCanStartRun(projectId, companyId);
    const run = await this.prisma.testRun.create({
      data: { projectId, status: TestRunStatus.PENDING },
    });
    this.runner.start(run.id);
    return run;
  }

  async list(projectId: string, companyId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.TestRunWhereInput = { projectId };
    const [data, total] = await Promise.all([
      this.prisma.testRun.findMany({ where, skip, take: query.limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.testRun.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
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
    await this.find(projectId, runId, companyId);
    this.runner.cancel(runId);
    return this.prisma.testRun.update({
      where: { id: runId },
      data: { status: TestRunStatus.CANCELLED, finishedAt: new Date() },
    });
  }
}
