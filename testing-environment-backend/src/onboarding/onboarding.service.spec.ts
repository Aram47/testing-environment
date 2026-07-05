import { OnboardingSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { OnboardingTemplatesService } from './onboarding-templates.service';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  it('records time to first successful run once', async () => {
    const prisma = {
      onboardingSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-1',
          startedAt: new Date('2026-07-05T10:00:00.000Z'),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new OnboardingService(
      prisma as unknown as PrismaService,
      {} as SubscriptionsService,
      {} as OnboardingTemplatesService,
    );

    const durationMs = await service.recordFirstSuccessfulRun(
      'project-1',
      new Date('2026-07-05T10:03:00.000Z'),
    );

    expect(durationMs).toBe(180000);
    expect(prisma.onboardingSession.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        status: OnboardingSessionStatus.COMPLETED,
        firstSuccessfulRunAt: null,
      },
      orderBy: { completedAt: 'asc' },
    });
    expect(prisma.onboardingSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', firstSuccessfulRunAt: null },
      data: {
        firstSuccessfulRunAt: new Date('2026-07-05T10:03:00.000Z'),
        timeToFirstSuccessfulRunMs: 180000,
      },
    });
  });
});
