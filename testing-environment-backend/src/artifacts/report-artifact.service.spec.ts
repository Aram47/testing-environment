import { TestResultStatus, TestRunStatus } from '@prisma/client';
import { FailureDiagnosisEngine } from '../test-runs/failure-diagnosis/failure-diagnosis.engine';
import { PrismaService } from '../prisma/prisma.service';
import { ArtifactsService } from './artifacts.service';
import { ReportArtifactService } from './report-artifact.service';

describe('ReportArtifactService', () => {
  it('builds schema v3 reports with diagnosis and immutable revision IDs', async () => {
    const service = createService();

    const report = await service.buildLegacyReport('project-1', 'run-1');

    expect(report).toMatchObject({
      schemaVersion: 3,
      run: { id: 'run-1', runnerVersion: 'runner-v1' },
      revisions: {
        environmentConfigRevisionId: 'env-revision-1',
        testSuiteRevisionIds: ['suite-revision-1'],
      },
      diagnosis: {
        category: 'unexpected_status',
        confidence: 0.95,
      },
    });
  });

  it('exports JUnit XML for report compatibility', async () => {
    const service = createService();

    const junit = await service.buildLegacyJunit('project-1', 'run-1');

    expect(junit).toContain('<testsuite');
    expect(junit).toContain('tests="1"');
    expect(junit).toContain('failures="1"');
    expect(junit).toContain('<failure message="Expected status 200, got 500"></failure>');
  });

  function createService() {
    const prisma = {
      testRun: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'run-1',
            projectId: 'project-1',
            status: TestRunStatus.TEST_FAILED,
            runnerVersion: 'runner-v1',
            startedAt: null,
            finishedAt: null,
            durationMs: 123,
            totalTests: 1,
            passedTests: 0,
            failedTests: 1,
            failureCategory: null,
            errorMessage: null,
            environmentConfigRevisionId: 'env-revision-1',
            environmentConfigRevision: { revisionNumber: 7 },
            suiteRevisions: [
              {
                suiteName: 'API',
                testSuiteId: null,
                testSuiteRevisionId: 'suite-revision-1',
                testSuiteRevision: { revisionNumber: 3 },
              },
            ],
            results: [
              {
                id: 'result-1',
                stepId: 'step-1',
                stepType: 'apiRequest',
                suiteName: 'API',
                testName: 'GET /health',
                status: TestResultStatus.FAILED,
                method: 'GET',
                path: '/health',
                expectedStatus: 200,
                actualStatus: 500,
                attempts: 1,
                durationMs: 123,
                requestBody: null,
                responseBody: null,
                responsePreview: { ok: false },
                responsePreviewTruncated: false,
                responseArtifactId: 'artifact-1',
                errorMessage: 'Expected status 200, got 500',
                createdAt: new Date('2026-07-05T00:00:00.000Z'),
              },
            ],
          }),
        ),
      },
      runnerLogChunk: {
        findMany: jest.fn(() => Promise.resolve([])),
      },
    };
    return new ReportArtifactService(
      prisma as unknown as PrismaService,
      { putOrReplace: jest.fn(), retentionUntil: jest.fn() } as unknown as ArtifactsService,
      new FailureDiagnosisEngine(),
    );
  }
});
