import {
  TestResultStatus,
  TestRunFailureCategory,
  TestRunStatus,
} from '@prisma/client';
import { FailureDiagnosisEngine } from './failure-diagnosis/failure-diagnosis.engine';
import { TestRunDiagnosisService } from './test-run-diagnosis.service';

describe('TestRunDiagnosisService', () => {
  const service = new TestRunDiagnosisService(new FailureDiagnosisEngine());

  it('builds test-step primary failure for TEST_FAILED runs', () => {
    const diagnosis = service.buildDiagnosis(
      {
        status: TestRunStatus.TEST_FAILED,
        failureCategory: TestRunFailureCategory.TEST_ASSERTION,
        statusReason: '1 test assertion(s) failed',
        errorMessage: null,
        cleanupError: null,
        runnerId: 'runner-1',
        cancellationReason: null,
        currentPhase: null,
        phaseTimestamps: {
          EXECUTING_TESTS: '2026-07-06T10:00:00.000Z',
        },
        queuedAt: new Date('2026-07-06T09:59:00.000Z'),
        claimedAt: new Date('2026-07-06T09:59:10.000Z'),
        startedAt: new Date('2026-07-06T09:59:20.000Z'),
        finishedAt: new Date('2026-07-06T10:00:30.000Z'),
        executionMetadata: {
          environmentResult: { status: 'passed', validationPassed: true },
          healthcheckResult: { status: 'passed', expectedStatus: 200, actualStatus: 200 },
        },
      },
      [
        {
          id: 'result-1',
          testRunId: 'run-1',
          stepId: 'step-1',
          stepType: 'apiRequest',
          suiteName: 'Suite',
          testName: 'Create user',
          status: TestResultStatus.FAILED,
          method: 'POST',
          path: '/users',
          expectedStatus: 201,
          actualStatus: 500,
          attempts: 1,
          durationMs: 120,
          requestBody: null,
          responseBody: null,
          responsePreview: { error: 'boom' },
          responsePreviewTruncated: false,
          responseArtifactId: null,
          errorMessage: 'Expected status 201, got 500',
          assertionResults: [
            {
              fieldPath: '$.status',
              operator: 'equals',
              expected: 201,
              actual: 500,
              passed: false,
              message: 'Expected status 201, got 500',
            },
          ],
          variablesSnapshot: { token: '***' },
          requestHeaders: null,
          responseHeaders: null,
          createdAt: new Date('2026-07-06T10:00:10.000Z'),
        },
      ],
    );

    expect(diagnosis.primaryFailure?.kind).toBe('test_step');
    expect(diagnosis.primaryFailure?.testResultId).toBe('result-1');
    expect(diagnosis.headline).toContain('Expected status 201');
    expect(diagnosis.environmentResult.status).toBe('passed');
    expect(diagnosis.healthcheckResult.status).toBe('passed');
    expect(diagnosis.structuredDiagnosis?.category).toBe('unexpected_status');
  });

  it('builds healthcheck primary failure from execution metadata', () => {
    const diagnosis = service.buildDiagnosis(
      {
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: TestRunFailureCategory.HEALTHCHECK,
        statusReason: 'Healthcheck failed',
        errorMessage: 'expected 200, got 503',
        cleanupError: null,
        runnerId: 'runner-1',
        cancellationReason: null,
        currentPhase: TestRunStatus.WAITING_FOR_HEALTHCHECK,
        phaseTimestamps: {
          WAITING_FOR_HEALTHCHECK: '2026-07-06T10:00:00.000Z',
        },
        queuedAt: new Date('2026-07-06T09:59:00.000Z'),
        claimedAt: new Date('2026-07-06T09:59:10.000Z'),
        startedAt: new Date('2026-07-06T09:59:20.000Z'),
        finishedAt: new Date('2026-07-06T10:00:30.000Z'),
        executionMetadata: {
          healthcheckResult: {
            status: 'failed',
            expectedStatus: 200,
            actualStatus: 503,
            message: 'expected 200, got 503',
          },
        },
      },
      [],
    );

    expect(diagnosis.primaryFailure?.kind).toBe('healthcheck');
    expect(diagnosis.primaryFailure?.actual).toBe(503);
  });

  it('builds phase timeline with durations', () => {
    const timeline = service.buildPhaseTimeline({
      status: TestRunStatus.PASSED,
      failureCategory: null,
      statusReason: null,
      errorMessage: null,
      cleanupError: null,
      runnerId: 'runner-1',
      cancellationReason: null,
      currentPhase: null,
      phaseTimestamps: {
        PREPARING_WORKSPACE: '2026-07-06T10:00:00.000Z',
        VALIDATING_ENVIRONMENT: '2026-07-06T10:00:10.000Z',
        PULLING_IMAGES: '2026-07-06T10:00:20.000Z',
        STARTING_ENVIRONMENT: '2026-07-06T10:00:30.000Z',
        WAITING_FOR_HEALTHCHECK: '2026-07-06T10:00:40.000Z',
        EXECUTING_TESTS: '2026-07-06T10:01:00.000Z',
        COLLECTING_ARTIFACTS: '2026-07-06T10:01:30.000Z',
        CLEANING_UP: '2026-07-06T10:01:40.000Z',
      },
      queuedAt: new Date('2026-07-06T09:59:00.000Z'),
      claimedAt: new Date('2026-07-06T09:59:50.000Z'),
      startedAt: new Date('2026-07-06T10:00:00.000Z'),
      finishedAt: new Date('2026-07-06T10:02:00.000Z'),
      executionMetadata: { usesDockerCompose: true },
    });

    const workspace = timeline.find((entry) => entry.id === 'workspace');
    expect(workspace?.durationMs).toBe(10_000);
    expect(timeline.find((entry) => entry.id === 'cleanup')?.finishedAt).toBe(
      '2026-07-06T10:02:00.000Z',
    );
  });
});
