import { Injectable } from '@nestjs/common';
import { Company, SubscriptionPlan, TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

export interface CompanyProfile {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  plan: {
    tier: SubscriptionPlan['name'];
    maxProjects: number;
    maxRunsPerMonth: number;
    maxConcurrentRuns: number;
    maxRunnerMinutes: number;
    reportRetentionDays: number;
    usage: {
      projectsUsed: number;
      runsThisMonth: number;
      concurrentRuns: number;
    };
  };
  membersCount: number;
}

type CompanyWithPlan = Company & {
  subscriptionPlan: SubscriptionPlan;
  _count: {
    projects: number;
    users: number;
  };
};

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(companyId: string): Promise<CompanyProfile> {
    const [company, runsThisMonth, concurrentRuns] = await this.getCompanyProfileData(companyId);
    return this.toCompanyProfile(company, runsThisMonth, concurrentRuns);
  }

  async updateMe(companyId: string, dto: UpdateCompanyDto): Promise<CompanyProfile> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: dto,
    });

    return this.getMe(companyId);
  }

  private getCompanyProfileData(companyId: string): Promise<[CompanyWithPlan, number, number]> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    return Promise.all([
      this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        include: {
          subscriptionPlan: true,
          _count: { select: { projects: true, users: true } },
        },
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
  }

  private toCompanyProfile(company: CompanyWithPlan, runsThisMonth: number, concurrentRuns: number): CompanyProfile {
    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      plan: {
        tier: company.subscriptionPlan.name,
        maxProjects: company.subscriptionPlan.maxProjects,
        maxRunsPerMonth: company.subscriptionPlan.maxRunsPerMonth,
        maxConcurrentRuns: company.subscriptionPlan.maxConcurrentRuns,
        maxRunnerMinutes: company.subscriptionPlan.maxRunnerMinutes,
        reportRetentionDays: company.subscriptionPlan.reportRetentionDays,
        usage: {
          projectsUsed: company._count.projects,
          runsThisMonth,
          concurrentRuns,
        },
      },
      membersCount: company._count.users,
    };
  }
}
