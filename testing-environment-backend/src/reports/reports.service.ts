import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async report(projectId: string, runId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const run = await this.prisma.testRun.findFirst({
      where: { id: runId, projectId },
      include: {
        project: true,
        environmentConfigRevision: true,
        suiteRevisions: {
          orderBy: { position: 'asc' },
          include: { testSuiteRevision: true },
        },
        results: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    return run;
  }

  async logs(projectId: string, runId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const run = await this.prisma.testRun.findFirst({ where: { id: runId, projectId } });
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    return this.prisma.runnerLog.findMany({
      where: { testRunId: runId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
