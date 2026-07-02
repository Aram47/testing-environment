import { ConflictException, Injectable } from '@nestjs/common';
import { TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { maxProjects: 'asc' } });
  }

  async assertCanCreateProject(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { subscriptionPlan: true, _count: { select: { projects: true } } },
    });
    if (company._count.projects >= company.subscriptionPlan.maxProjects) {
      throw new ConflictException('Project limit reached for current subscription plan');
    }
  }

  async assertCanStartRun(projectId: string, companyId: string): Promise<void> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { subscriptionPlan: true },
    });
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [runsThisMonth, concurrentRuns] = await Promise.all([
      this.prisma.testRun.count({
        where: {
          project: { companyId },
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.testRun.count({
        where: {
          project: { companyId },
          status: { in: [TestRunStatus.PENDING, TestRunStatus.RUNNING] },
        },
      }),
      this.prisma.project.findFirstOrThrow({ where: { id: projectId, companyId } }),
    ]);

    if (runsThisMonth >= company.subscriptionPlan.maxRunsPerMonth) {
      throw new ConflictException('Monthly test run limit reached for current subscription plan');
    }
    if (concurrentRuns >= company.subscriptionPlan.maxConcurrentRuns) {
      throw new ConflictException('Concurrent test run limit reached for current subscription plan');
    }
  }
}
