import { NotFoundException } from '@nestjs/common';
import { ResourceResolverService } from './resource-resolver.service';

describe('ResourceResolverService', () => {
  const prisma = {
    project: { findUnique: jest.fn() },
    testRun: { findFirst: jest.fn() },
    secret: { findFirst: jest.fn() },
    testSuite: { findFirst: jest.fn() },
    testSuiteRevision: { findFirst: jest.fn() },
    environmentConfigRevision: { findFirst: jest.fn() },
  };
  const service = new ResourceResolverService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves run resources with company and project ownership', async () => {
    prisma.testRun.findFirst.mockResolvedValue({
      id: 'run-1',
      projectId: 'project-1',
      project: { companyId: 'company-1' },
    });

    await expect(
      service.resolve({ params: { projectId: 'project-1', runId: 'run-1' } } as never, {
        action: 'run:read',
        resourceType: 'run',
      }),
    ).resolves.toEqual({
      type: 'run',
      id: 'run-1',
      projectId: 'project-1',
      companyId: 'company-1',
    });
  });

  it('throws not found when a resource id does not match its parent project', async () => {
    prisma.testRun.findFirst.mockResolvedValue(null);

    await expect(
      service.resolve({ params: { projectId: 'project-1', runId: 'run-2' } } as never, {
        action: 'run:read',
        resourceType: 'run',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
