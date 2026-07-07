import {
  RunnerLogSource,
  TestResultStatus,
  TestRunFailureCategory,
  TestRunStatus,
} from '@prisma/client';
import { sanitizeDetail } from './failure-diagnosis-context';
import { FailureDiagnosisEngine } from './failure-diagnosis.engine';

describe('FailureDiagnosisEngine', () => {
  const engine = new FailureDiagnosisEngine();

  it('returns null for passed runs', () => {
    const diagnosis = engine.diagnose(
      { ...baseRun(), status: TestRunStatus.PASSED },
      [],
    );
    expect(diagnosis).toBeNull();
  });

  it('diagnoses compose_validation_failed', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: TestRunFailureCategory.ENVIRONMENT_VALIDATION,
        errorMessage: 'Service api cannot use privileged mode',
        executionMetadata: {
          environmentResult: {
            status: 'failed',
            validationPassed: false,
            message: 'Service api cannot use privileged mode',
          },
        },
      },
      [],
    );
    expect(diagnosis?.category).toBe('compose_validation_failed');
    expect(diagnosis?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('diagnoses image_pull_failed', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: TestRunFailureCategory.IMAGE_PULL,
        errorMessage: 'docker compose pull failed: manifest unknown',
        executionMetadata: {
          imageReferences: [{ serviceName: 'api', image: 'ghcr.io/example/api:latest' }],
        },
      },
      [],
    );
    expect(diagnosis?.category).toBe('image_pull_failed');
    expect(diagnosis?.primaryEvidence.some((item) => item.label === 'Runner error')).toBe(true);
  });

  it('diagnoses container_exited', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: TestRunFailureCategory.CONTAINER_START,
        errorMessage: 'docker compose up failed with code 1: container api exited (137)',
      },
      [],
      [{ sequence: 1, source: RunnerLogSource.DOCKER, preview: 'api exited with code 137' }],
    );
    expect(diagnosis?.category).toBe('container_exited');
    expect(diagnosis?.summary).toContain('137');
  });

  it('diagnoses port_conflict', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: TestRunFailureCategory.CONTAINER_START,
        errorMessage: 'Bind for 0.0.0.0:5432 failed: port is already allocated',
      },
      [],
    );
    expect(diagnosis?.category).toBe('port_conflict');
    expect(diagnosis?.summary).toContain('5432');
  });

  it('diagnoses healthcheck_timeout', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.TIMED_OUT,
        failureCategory: TestRunFailureCategory.TIMEOUT,
        errorMessage: 'Healthcheck timed out after 60 seconds',
        phaseTimestamps: { WAITING_FOR_HEALTHCHECK: '2026-07-06T10:00:00.000Z' },
        executionMetadata: {
          healthcheckResult: {
            status: 'failed',
            expectedStatus: 200,
            actualStatus: undefined,
            durationMs: 60000,
            url: 'http://localhost:3000/health',
            message: 'Healthcheck timed out after 60 seconds',
          },
        },
      },
      [],
    );
    expect(diagnosis?.category).toBe('healthcheck_timeout');
  });

  it('diagnoses dns_network_failure', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: TestRunFailureCategory.NETWORK,
        errorMessage: 'getaddrinfo ENOTFOUND api.internal',
      },
      [],
    );
    expect(diagnosis?.category).toBe('dns_network_failure');
  });

  it('diagnoses http_timeout', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.TEST_FAILED,
        failureCategory: TestRunFailureCategory.TEST_ASSERTION,
      },
      [failedResult({ errorMessage: 'The operation was aborted due to timeout', stepType: 'apiRequest' })],
    );
    expect(diagnosis?.category).toBe('http_timeout');
  });

  it('diagnoses unexpected_status', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.TEST_FAILED,
        failureCategory: TestRunFailureCategory.TEST_ASSERTION,
      },
      [
        failedResult({
          expectedStatus: 201,
          actualStatus: 500,
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
          ] as unknown as null,
        }),
      ],
    );
    expect(diagnosis?.category).toBe('unexpected_status');
  });

  it('diagnoses assertion_mismatch', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.TEST_FAILED,
        failureCategory: TestRunFailureCategory.TEST_ASSERTION,
      },
      [
        failedResult({
          stepType: 'assert',
          errorMessage: 'Expected id to equal user-1',
          assertionResults: [
            {
              fieldPath: '$.id',
              operator: 'equals',
              expected: 'user-1',
              actual: 'user-2',
              passed: false,
              message: 'Expected id to equal user-1',
            },
          ] as unknown as null,
        }),
      ],
    );
    expect(diagnosis?.category).toBe('assertion_mismatch');
    expect(diagnosis?.primaryEvidence.some((item) => item.label.includes('$.id'))).toBe(true);
  });

  it('diagnoses variable_extraction_failed', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.TEST_FAILED,
        failureCategory: TestRunFailureCategory.TEST_ASSERTION,
      },
      [
        failedResult({
          stepType: 'setVariable',
          errorMessage: 'Failed to extract variable from JSON path $.token',
        }),
      ],
    );
    expect(diagnosis?.category).toBe('variable_extraction_failed');
  });

  it('diagnoses cancelled', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.CANCELLED,
        failureCategory: TestRunFailureCategory.CANCELLED,
        cancellationReason: 'Cancelled by user',
        cleanupError: 'docker compose down failed',
      },
      [],
    );
    expect(diagnosis?.category).toBe('cancelled');
    expect(diagnosis?.relatedEvidence.some((item) => item.ref?.field === 'cleanupError')).toBe(
      true,
    );
  });

  it('diagnoses cleanup_failed as primary when it is the only failure signal', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.PASSED,
        failureCategory: null,
        cleanupError: 'docker compose down failed: permission denied',
        errorMessage: null,
      },
      [],
    );
    expect(diagnosis).toBeNull();
  });

  it('diagnoses cleanup_failed when cleanup is the only driver on infra edge case', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: null,
        cleanupError: 'docker compose down failed: permission denied',
        errorMessage: null,
      },
      [],
    );
    expect(diagnosis?.category).toBe('cleanup_failed');
  });

  it('diagnoses internal_runner_error as fallback', () => {
    const diagnosis = engine.diagnose(
      {
        ...baseRun(),
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: TestRunFailureCategory.INTERNAL,
        errorMessage: 'Unexpected worker crash',
      },
      [],
    );
    expect(diagnosis?.category).toBe('internal_runner_error');
    expect(diagnosis?.confidence).toBe(0.5);
  });

  it('redacts secrets in evidence detail', () => {
    const redacted = sanitizeDetail(
      'Request failed with authorization="super-secret-token" and password=abc123',
    );
    expect(redacted).not.toContain('super-secret-token');
    expect(redacted).not.toContain('abc123');
    expect(redacted).toContain('***');
  });
});

function baseRun() {
  return {
    status: TestRunStatus.TEST_FAILED,
    failureCategory: TestRunFailureCategory.TEST_ASSERTION,
    statusReason: null,
    errorMessage: null,
    cleanupError: null,
    runnerId: 'runner-1',
    cancellationReason: null,
    currentPhase: null,
    phaseTimestamps: null,
    executionMetadata: null,
  };
}

function failedResult(
  overrides: Partial<ReturnType<typeof baseResult>> = {},
): ReturnType<typeof baseResult> {
  return { ...baseResult(), ...overrides };
}

function baseResult() {
  return {
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
    responsePreview: null,
    responsePreviewTruncated: false,
    responseArtifactId: null,
    errorMessage: 'Test failed',
    assertionResults: null,
    variablesSnapshot: null,
    requestHeaders: null,
    responseHeaders: null,
    createdAt: new Date('2026-07-06T10:00:10.000Z'),
  };
}
