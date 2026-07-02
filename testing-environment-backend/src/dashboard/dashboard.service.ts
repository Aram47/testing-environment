import { Injectable } from '@nestjs/common';
import { TestRun, TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardTestRun {
  id: string;
  projectId: string;
  status: TestRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number | null;
}

export interface DashboardSummary {
  totalProjects: number;
  recentRuns: DashboardTestRun[];
  passed: number;
  failed: number;
  plan: {
    tier: string;
    maxProjects: number;
    maxRunsPerMonth: number;
    maxConcurrentRuns: number;
    reportRetentionDays: number;
    usage: {
      projectsUsed: number;
      runsThisMonth: number;
      concurrentRuns: number;
    };
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(companyId: string): Promise<DashboardSummary> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [company, totalProjects, recentRuns, aggregate, runsThisMonth, concurrentRuns] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        include: { subscriptionPlan: true },
      }),
      this.prisma.project.count({ where: { companyId } }),
      this.prisma.testRun.findMany({
        where: { project: { companyId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.testRun.aggregate({
        where: { project: { companyId } },
        _sum: { passedTests: true, failedTests: true },
      }),
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

    return {
      totalProjects,
      recentRuns: recentRuns.map((run) => this.toDashboardRun(run)),
      passed: aggregate._sum.passedTests ?? 0,
      failed: aggregate._sum.failedTests ?? 0,
      plan: {
        tier: company.subscriptionPlan.name,
        maxProjects: company.subscriptionPlan.maxProjects,
        maxRunsPerMonth: company.subscriptionPlan.maxRunsPerMonth,
        maxConcurrentRuns: company.subscriptionPlan.maxConcurrentRuns,
        reportRetentionDays: company.subscriptionPlan.reportRetentionDays,
        usage: {
          projectsUsed: totalProjects,
          runsThisMonth,
          concurrentRuns,
        },
      },
    };
  }

  private toDashboardRun(run: TestRun): DashboardTestRun {
    return {
      id: run.id,
      projectId: run.projectId,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      totalTests: run.totalTests,
      passed: run.passedTests,
      failed: run.failedTests,
      durationMs: run.durationMs,
    };
  }
}
