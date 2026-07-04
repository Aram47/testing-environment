import { ConflictException } from '@nestjs/common';
import { SubscriptionPlanName } from '@prisma/client';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  const companyId = 'company-1';
  const freePlan = createPlan('free-plan', SubscriptionPlanName.FREE, 2, 50, 1);
  const proPlan = createPlan('pro-plan', SubscriptionPlanName.PRO, 10, 500, 3);
  let prisma: {
    company: {
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    subscriptionPlan: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    project: {
      count: jest.Mock;
    };
    testRun: {
      count: jest.Mock;
    };
  };
  let companies: {
    getMe: jest.Mock;
  };
  let service: SubscriptionsService;

  beforeEach(() => {
    prisma = {
      company: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      subscriptionPlan: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      project: {
        count: jest.fn(),
      },
      testRun: {
        count: jest.fn(),
      },
    };
    companies = {
      getMe: jest.fn(() =>
        Promise.resolve({ id: companyId, plan: { tier: SubscriptionPlanName.PRO } }),
      ),
    };
    service = new SubscriptionsService(
      prisma as unknown as PrismaService,
      companies as unknown as CompaniesService,
    );
  });

  it('changes plan when usage fits target limits', async () => {
    mockCurrentPlan(freePlan);
    mockTargetPlan(proPlan);
    mockUsage({ projectsUsed: 2, runsThisMonth: 40, concurrentRuns: 1 });

    await service.changePlan(companyId, SubscriptionPlanName.PRO);

    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: companyId },
      data: { subscriptionPlanId: proPlan.id },
    });
    expect(companies.getMe).toHaveBeenCalledWith(companyId);
  });

  it('returns current profile when selected plan is already active', async () => {
    mockCurrentPlan(proPlan);
    mockTargetPlan(proPlan);
    mockUsage({ projectsUsed: 2, runsThisMonth: 40, concurrentRuns: 1 });

    await service.changePlan(companyId, SubscriptionPlanName.PRO);

    expect(prisma.company.update).not.toHaveBeenCalled();
    expect(companies.getMe).toHaveBeenCalledWith(companyId);
  });

  it('blocks downgrade when projects exceed target plan limit', async () => {
    mockCurrentPlan(proPlan);
    mockTargetPlan(freePlan);
    mockUsage({ projectsUsed: 3, runsThisMonth: 40, concurrentRuns: 1 });

    await expect(service.changePlan(companyId, SubscriptionPlanName.FREE)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  it('blocks downgrade when monthly runs exceed target plan limit', async () => {
    mockCurrentPlan(proPlan);
    mockTargetPlan(freePlan);
    mockUsage({ projectsUsed: 2, runsThisMonth: 51, concurrentRuns: 1 });

    await expect(service.changePlan(companyId, SubscriptionPlanName.FREE)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  it('blocks downgrade when concurrent runs exceed target plan limit', async () => {
    mockCurrentPlan(proPlan);
    mockTargetPlan(freePlan);
    mockUsage({ projectsUsed: 2, runsThisMonth: 50, concurrentRuns: 2 });

    await expect(service.changePlan(companyId, SubscriptionPlanName.FREE)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  function mockCurrentPlan(plan: ReturnType<typeof createPlan>) {
    prisma.company.findUniqueOrThrow.mockResolvedValue({
      id: companyId,
      subscriptionPlanId: plan.id,
    });
  }

  function mockTargetPlan(plan: ReturnType<typeof createPlan>) {
    prisma.subscriptionPlan.findUnique.mockResolvedValue(plan);
  }

  function mockUsage(usage: {
    projectsUsed: number;
    runsThisMonth: number;
    concurrentRuns: number;
  }) {
    prisma.project.count.mockResolvedValue(usage.projectsUsed);
    prisma.testRun.count
      .mockResolvedValueOnce(usage.runsThisMonth)
      .mockResolvedValueOnce(usage.concurrentRuns);
  }
});

function createPlan(
  id: string,
  name: SubscriptionPlanName,
  maxProjects: number,
  maxRunsPerMonth: number,
  maxConcurrentRuns: number,
) {
  return {
    id,
    name,
    maxProjects,
    maxRunsPerMonth,
    maxConcurrentRuns,
    maxRunnerMinutes: 1000,
    reportRetentionDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
