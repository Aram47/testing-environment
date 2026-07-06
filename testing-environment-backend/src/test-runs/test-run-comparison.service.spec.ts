import { TestResultStatus, TestRunStatus } from '@prisma/client';
import { TestRunComparisonService } from './test-run-comparison.service';

describe('TestRunComparisonService', () => {
  const prisma = {
    testRun: {
      findFirst: jest.fn(),
    },
  };
  const service = new TestRunComparisonService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null baseline when no previous passed run exists', async () => {
    prisma.testRun.findFirst.mockResolvedValue(null);
    const result = await service.compare({
      id: 'run-2',
      projectId: 'project-1',
      status: TestRunStatus.TEST_FAILED,
      finishedAt: new Date('2026-07-06T11:00:00.000Z'),
      executionMetadata: { imageReferences: [{ serviceName: 'api', image: 'node:22' }] },
      environmentConfigRevision: { id: 'env-2', revisionNumber: 2 },
      suiteRevisions: [
        {
          suiteName: 'Suite A',
          testSuiteRevision: { revisionNumber: 3 },
        },
      ],
      results: [
        {
          id: 'result-2',
          testRunId: 'run-2',
          stepId: 'step-1',
          stepType: 'apiRequest',
          suiteName: 'Suite A',
          testName: 'Create user',
          status: TestResultStatus.FAILED,
          method: 'POST',
          path: '/users',
          expectedStatus: 201,
          actualStatus: 500,
          attempts: 1,
          durationMs: 300,
          requestBody: null,
          responseBody: null,
          responsePreview: null,
          responsePreviewTruncated: false,
          responseArtifactId: null,
          errorMessage: 'failed',
          assertionResults: null,
          variablesSnapshot: null,
          requestHeaders: null,
          responseHeaders: null,
          createdAt: new Date(),
        },
      ],
    } as never);

    expect(result.baselineRun).toBeNull();
    expect(result.stepDiffs[0]?.baselineStatus).toBeUndefined();
  });

  it('compares revisions, images, and timing regression', async () => {
    prisma.testRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: TestRunStatus.PASSED,
      finishedAt: new Date('2026-07-06T10:00:00.000Z'),
      executionMetadata: { imageReferences: [{ serviceName: 'api', image: 'node:20' }] },
      environmentConfigRevision: { id: 'env-1', revisionNumber: 1 },
      suiteRevisions: [
        {
          suiteName: 'Suite A',
          testSuiteRevision: { revisionNumber: 2 },
        },
      ],
      results: [
        {
          stepId: 'step-1',
          testName: 'Create user',
          status: TestResultStatus.PASSED,
          actualStatus: 201,
          durationMs: 100,
        },
      ],
    });

    const result = await service.compare({
      id: 'run-2',
      projectId: 'project-1',
      status: TestRunStatus.TEST_FAILED,
      finishedAt: new Date('2026-07-06T11:00:00.000Z'),
      executionMetadata: { imageReferences: [{ serviceName: 'api', image: 'node:22' }] },
      environmentConfigRevision: { id: 'env-2', revisionNumber: 2 },
      suiteRevisions: [
        {
          suiteName: 'Suite A',
          testSuiteRevision: { revisionNumber: 3 },
        },
      ],
      results: [
        {
          id: 'result-2',
          testRunId: 'run-2',
          stepId: 'step-1',
          stepType: 'apiRequest',
          suiteName: 'Suite A',
          testName: 'Create user',
          status: TestResultStatus.FAILED,
          method: 'POST',
          path: '/users',
          expectedStatus: 201,
          actualStatus: 500,
          attempts: 1,
          durationMs: 250,
          requestBody: null,
          responseBody: null,
          responsePreview: null,
          responsePreviewTruncated: false,
          responseArtifactId: null,
          errorMessage: 'failed',
          assertionResults: null,
          variablesSnapshot: null,
          requestHeaders: null,
          responseHeaders: null,
          createdAt: new Date(),
        },
      ],
    } as never);

    expect(result.revisions.environment.changed).toBe(true);
    expect(result.revisions.suites[0]?.changed).toBe(true);
    expect(result.imageReferences[0]?.changed).toBe(true);
    expect(result.stepDiffs[0]?.statusChanged).toBe(true);
    expect(result.stepDiffs[0]?.durationRegressionPercent).toBe(150);
    expect(result.summary.stepsWithStatusChange).toBe(1);
    expect(result.summary.stepsWithTimingRegression).toBe(1);
  });
});
