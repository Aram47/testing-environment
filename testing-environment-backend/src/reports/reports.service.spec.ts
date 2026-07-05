import { ArtifactCompression, ArtifactType } from '@prisma/client';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { ReportArtifactService } from '../artifacts/report-artifact.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('falls back to legacy report assembly for runs without report artifacts', async () => {
    const legacyReport = {
      revisions: {
        testSuites: [
          {
            testSuiteId: null,
            testSuiteRevisionId: 'suite-revision-1',
            revisionNumber: 1,
          },
        ],
      },
    };
    const prisma = {
      testRun: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'run-1',
          }),
        ),
      },
      artifact: {
        findFirst: jest.fn(() => Promise.resolve(null)),
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
      { read: jest.fn() } as unknown as ArtifactsService,
      {
        buildLegacyReport: jest.fn(() => Promise.resolve(legacyReport)),
      } as unknown as ReportArtifactService,
    );

    const report = await service.report('project-1', 'run-1', 'company-1');

    expect(report.revisions.testSuites[0].testSuiteId).toBeNull();
    expect(report.revisions.testSuites[0].revisionNumber).toBe(1);
  });

  it('returns artifact-backed report when report artifact exists', async () => {
    const prisma = {
      testRun: {
        findFirst: jest.fn(() => Promise.resolve({ id: 'run-1' })),
      },
      artifact: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'artifact-1',
            objectKey: 'runs/run-1/report.json',
            compression: ArtifactCompression.NONE,
            type: ArtifactType.REPORT_JSON,
          }),
        ),
      },
    };
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      {
        getProjectOrThrow: jest.fn(() => Promise.resolve({ id: 'project-1' })),
      } as unknown as ProjectAccessService,
      {
        read: jest.fn(() => Promise.resolve(Buffer.from('{"schemaVersion":2}', 'utf8'))),
      } as unknown as ArtifactsService,
      { buildLegacyReport: jest.fn() } as unknown as ReportArtifactService,
    );

    await expect(service.report('project-1', 'run-1', 'company-1')).resolves.toEqual({
      schemaVersion: 2,
    });
  });
});
