import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionPlanName, TestRunStatus } from '@prisma/client';
import { CompaniesService, CompanyProfile } from '../companies/companies.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { maxProjects: 'asc' } });
  }

  async changePlan(companyId: string, planName: SubscriptionPlanName): Promise<CompanyProfile> {
    const [company, targetPlan, usage] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      this.prisma.subscriptionPlan.findUnique({ where: { name: planName } }),
      this.getUsage(companyId),
    ]);
    if (!targetPlan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (company.subscriptionPlanId === targetPlan.id) {
      return this.companies.getMe(companyId);
    }

    this.assertUsageFitsPlan(targetPlan, usage);

    // Temporary local switch. Later this should be confirmed by Stripe checkout/webhook state.
    await this.prisma.company.update({
      where: { id: companyId },
      data: { subscriptionPlanId: targetPlan.id },
    });

    return this.companies.getMe(companyId);
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
      throw new ConflictException(
        'Concurrent test run limit reached for current subscription plan',
      );
    }
  }

  private async getUsage(
    companyId: string,
  ): Promise<{ projectsUsed: number; runsThisMonth: number; concurrentRuns: number }> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [projectsUsed, runsThisMonth, concurrentRuns] = await Promise.all([
      this.prisma.project.count({ where: { companyId } }),
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
    ]);

    return { projectsUsed, runsThisMonth, concurrentRuns };
  }

  private assertUsageFitsPlan(
    plan: SubscriptionPlan,
    usage: { projectsUsed: number; runsThisMonth: number; concurrentRuns: number },
  ): void {
    if (usage.projectsUsed > plan.maxProjects) {
      throw new ConflictException(`Current project usage exceeds the ${plan.name} plan limit`);
    }
    if (usage.runsThisMonth > plan.maxRunsPerMonth) {
      throw new ConflictException(`Current monthly run usage exceeds the ${plan.name} plan limit`);
    }
    if (usage.concurrentRuns > plan.maxConcurrentRuns) {
      throw new ConflictException(
        `Current concurrent run usage exceeds the ${plan.name} plan limit`,
      );
    }
  }
}
