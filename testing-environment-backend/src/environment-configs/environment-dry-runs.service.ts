import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnvironmentDryRunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentDryRunQueueService } from '../queue/environment-dry-run-queue.service';
import { CreateEnvironmentDryRunDto } from './dto/create-environment-dry-run.dto';

@Injectable()
export class EnvironmentDryRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly queue: EnvironmentDryRunQueueService,
  ) {}

  async create(projectId: string, companyId: string, dto: CreateEnvironmentDryRunDto) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const revision = await this.prisma.environmentConfigRevision.findFirst({
      where: {
        id: dto.revisionId,
        environmentConfig: { projectId },
      },
    });
    if (!revision) {
      throw new NotFoundException('Environment config revision not found');
    }

    const dryRunId = randomUUID();
    const queueJobId = this.queue.getJobId(dryRunId);
    const dryRun = await this.prisma.environmentDryRun.create({
      data: {
        id: dryRunId,
        projectId,
        environmentConfigRevisionId: revision.id,
        status: EnvironmentDryRunStatus.CREATED,
        queueJobId,
        runnerVersion: process.env.TEST_RUN_RUNNER_VERSION ?? 'local',
      },
      include: {
        environmentConfigRevision: true,
      },
    });

    try {
      await this.queue.enqueue(dryRun.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue environment dry run';
      await this.prisma.environmentDryRun.update({
        where: { id: dryRun.id },
        data: {
          status: EnvironmentDryRunStatus.INFRA_FAILED,
          errorMessage: message,
          finishedAt: new Date(),
        },
      });
      throw new BadRequestException(message);
    }

    return this.find(projectId, companyId, dryRun.id);
  }

  async list(projectId: string, companyId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.environmentDryRun.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { environmentConfigRevision: true },
      }),
      this.prisma.environmentDryRun.count({ where: { projectId } }),
    ]);
    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async find(projectId: string, companyId: string, dryRunId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const dryRun = await this.prisma.environmentDryRun.findFirst({
      where: { id: dryRunId, projectId },
      include: {
        environmentConfigRevision: true,
        logs: { orderBy: { createdAt: 'asc' }, take: 200 },
      },
    });
    if (!dryRun) {
      throw new NotFoundException('Environment dry run not found');
    }
    return dryRun;
  }

  async cancel(projectId: string, companyId: string, dryRunId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const dryRun = await this.prisma.environmentDryRun.findFirst({
      where: { id: dryRunId, projectId },
    });
    if (!dryRun) {
      throw new NotFoundException('Environment dry run not found');
    }
    if (
      dryRun.status === EnvironmentDryRunStatus.PASSED ||
      dryRun.status === EnvironmentDryRunStatus.INFRA_FAILED ||
      dryRun.status === EnvironmentDryRunStatus.CANCELLED
    ) {
      return this.find(projectId, companyId, dryRunId);
    }

    const updated = await this.prisma.environmentDryRun.updateMany({
      where: {
        id: dryRunId,
        projectId,
        status: {
          notIn: [
            EnvironmentDryRunStatus.PASSED,
            EnvironmentDryRunStatus.INFRA_FAILED,
            EnvironmentDryRunStatus.CANCELLED,
          ],
        },
      },
      data: {
        status: EnvironmentDryRunStatus.CANCEL_REQUESTED,
        cancelRequestedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      return this.find(projectId, companyId, dryRunId);
    }
    await this.queue.cancelQueuedRun(dryRunId);
    return this.find(projectId, companyId, dryRunId);
  }
}
