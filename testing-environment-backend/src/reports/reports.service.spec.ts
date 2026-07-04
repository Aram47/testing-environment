import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('returns run reports from snapshot revisions even when logical suite is detached', async () => {
    const prisma = {
      testRun: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'run-1',
            projectId: 'project-1',
            environmentConfigRevision: { id: 'environment-revision-1', revisionNumber: 1 },
            suiteRevisions: [
              {
                id: 'snapshot-1',
                testSuiteId: null,
                suiteName: 'Deleted suite',
                testSuiteRevision: { id: 'suite-revision-1', revisionNumber: 1 },
              },
            ],
            results: [],
          }),
        ),
      },
      runnerLog: {
        findMany: jest.fn(),
      },
    };
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      {
        getProjectOrThrow: jest.fn(() => Promise.resolve({ id: 'project-1' })),
      } as unknown as ProjectAccessService,
    );

    const report = await service.report('project-1', 'run-1', 'company-1');

    expect(report.suiteRevisions[0].testSuiteId).toBeNull();
    expect(report.suiteRevisions[0].testSuiteRevision.revisionNumber).toBe(1);
  });
});
