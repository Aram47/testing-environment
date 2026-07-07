import { Injectable } from '@nestjs/common';
import {
  TestResult,
  TestResultStatus,
  TestRunFailureCategory,
  TestRunStatus,
} from '@prisma/client';
import { StoredAssertionResult } from '../types/test-run-execution-metadata.types';
import { sanitizeDetail } from './failure-diagnosis-context';
import {
  CONTAINER_EXIT_PATTERN,
  extractExitCode,
  extractPortFromMessage,
  IMAGE_PULL_PATTERN,
  NETWORK_PATTERN,
  PORT_CONFLICT_PATTERN,
  TIMEOUT_PATTERN,
  VARIABLE_EXTRACTION_PATTERN,
} from './failure-diagnosis.patterns';
import {
  DiagnosisEvidence,
  DiagnosisRun,
  FailureDiagnosisCategory,
  FailureDiagnosisContext,
  isTerminalFailureStatus,
  LogChunkPreview,
  RunDiagnosis,
  SuggestedAction,
} from './failure-diagnosis.types';
import { buildFailureDiagnosisContext } from './failure-diagnosis-context';

@Injectable()
export class FailureDiagnosisEngine {
  diagnose(
    run: DiagnosisRun,
    results: TestResult[],
    logPreviews: LogChunkPreview[] = [],
  ): RunDiagnosis | null {
    if (run.status === TestRunStatus.PASSED || !isTerminalFailureStatus(run.status)) {
      return null;
    }

    const context = buildFailureDiagnosisContext(run, results, logPreviews);

    if (run.status === TestRunStatus.CANCELLED) {
      return this.diagnoseCancelled(context);
    }

    if (this.isCleanupOnlyFailure(context)) {
      return this.diagnoseCleanupFailed(context);
    }

    if (run.status === TestRunStatus.TEST_FAILED) {
      return this.diagnoseTestFailure(context);
    }

    if (run.status === TestRunStatus.TIMED_OUT) {
      return this.diagnoseTimeout(context);
    }

    if (run.status === TestRunStatus.INFRA_FAILED) {
      return this.diagnoseInfraFailure(context);
    }

    return this.diagnoseInternal(context);
  }

  private diagnoseCancelled(context: FailureDiagnosisContext): RunDiagnosis {
    const reason = sanitizeDetail(
      context.run.cancellationReason ?? context.run.statusReason ?? 'Run was cancelled',
    );
    const relatedEvidence: DiagnosisEvidence[] = [];
    if (context.run.cleanupError) {
      relatedEvidence.push(
        this.runFieldEvidence('Cleanup error', context.run.cleanupError, 'cleanupError'),
      );
    }

    return {
      category: 'cancelled',
      title: 'Test run was cancelled',
      summary: reason || 'The run was cancelled before completion.',
      primaryEvidence: [
        this.runFieldEvidence('Cancellation reason', reason || 'No reason provided', 'cancellationReason'),
      ],
      relatedEvidence,
      suggestedActions: [
        {
          id: 'review-cancel-reason',
          label: 'Review cancellation reason',
          description: 'Check who requested cancellation and whether the environment was left running.',
          priority: 'medium',
        },
        ...(context.run.cleanupError
          ? [
              {
                id: 'manual-cleanup',
                label: 'Run manual cleanup',
                description:
                  'Docker compose down failed during cancellation. Stop leftover containers on the runner host.',
                priority: 'high' as const,
              },
            ]
          : []),
      ],
      confidence: 0.95,
    };
  }

  private diagnoseCleanupFailed(context: FailureDiagnosisContext): RunDiagnosis {
    const cleanupError = sanitizeDetail(context.run.cleanupError ?? 'Cleanup failed');
    return {
      category: 'cleanup_failed',
      title: 'Environment cleanup failed',
      summary: cleanupError,
      primaryEvidence: [this.runFieldEvidence('Cleanup error', cleanupError, 'cleanupError')],
      relatedEvidence: this.dockerLogEvidence(context),
      suggestedActions: [
        {
          id: 'manual-compose-down',
          label: 'Run docker compose down manually',
          description: 'On the runner host, stop and remove containers for this test workspace.',
          priority: 'high',
        },
        {
          id: 'check-runner-logs',
          label: 'Inspect runner Docker logs',
          description: 'Review DOCKER log chunks for the exact compose down failure.',
          priority: 'medium',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseTestFailure(context: FailureDiagnosisContext): RunDiagnosis {
    const result = context.failedResult;
    if (!result) {
      return this.diagnoseInternal(context);
    }

    if (result.stepType === 'setVariable' || this.isVariableExtractionFailure(result, context)) {
      return this.diagnoseVariableExtraction(context, result);
    }

    if (result.stepType === 'assert' || this.hasFailedJsonAssertion(result)) {
      return this.diagnoseAssertionMismatch(context, result);
    }

    if (this.isHttpTimeout(result, context)) {
      return this.diagnoseHttpTimeout(context, result);
    }

    if (this.isUnexpectedStatus(result)) {
      return this.diagnoseUnexpectedStatus(context, result);
    }

    return this.diagnoseAssertionMismatch(context, result);
  }

  private diagnoseTimeout(context: FailureDiagnosisContext): RunDiagnosis {
    if (
      context.run.failureCategory === TestRunFailureCategory.HEALTHCHECK ||
      context.phaseTimestamps[TestRunStatus.WAITING_FOR_HEALTHCHECK] ||
      TIMEOUT_PATTERN.test(context.message)
    ) {
      return this.diagnoseHealthcheckTimeout(context);
    }
    return this.diagnoseInternal(context, 'Run timed out before completing all phases.');
  }

  private diagnoseInfraFailure(context: FailureDiagnosisContext): RunDiagnosis {
    const category = context.run.failureCategory;

    if (category === TestRunFailureCategory.ENVIRONMENT_VALIDATION) {
      return this.diagnoseComposeValidation(context);
    }
    if (category === TestRunFailureCategory.IMAGE_PULL || IMAGE_PULL_PATTERN.test(context.message)) {
      return this.diagnoseImagePull(context);
    }
    if (category === TestRunFailureCategory.CONTAINER_START) {
      if (PORT_CONFLICT_PATTERN.test(context.message)) {
        return this.diagnosePortConflict(context);
      }
      if (CONTAINER_EXIT_PATTERN.test(context.message)) {
        return this.diagnoseContainerExited(context);
      }
      return this.diagnoseContainerExited(context);
    }
    if (category === TestRunFailureCategory.HEALTHCHECK) {
      if (TIMEOUT_PATTERN.test(context.message)) {
        return this.diagnoseHealthcheckTimeout(context);
      }
      return this.diagnoseHealthcheckFailure(context);
    }
    if (category === TestRunFailureCategory.NETWORK || NETWORK_PATTERN.test(context.message)) {
      return this.diagnoseNetworkFailure(context);
    }
    if (category === TestRunFailureCategory.TIMEOUT) {
      return this.diagnoseTimeout(context);
    }
    if (category === TestRunFailureCategory.INTERNAL) {
      return this.diagnoseInternal(context);
    }

    return this.diagnoseInternal(context);
  }

  private diagnoseComposeValidation(context: FailureDiagnosisContext): RunDiagnosis {
    const env = context.metadata.environmentResult;
    const message = sanitizeDetail(
      env?.message ?? context.run.errorMessage ?? context.run.statusReason ?? 'Compose validation failed',
    );
    return {
      category: 'compose_validation_failed',
      title: 'Docker Compose validation failed',
      summary: message,
      primaryEvidence: [
        {
          type: 'environment',
          label: 'Environment validation',
          detail: message,
          ref: { phaseId: 'validation' },
        },
      ],
      relatedEvidence: this.phaseEvidence(context, TestRunStatus.VALIDATING_ENVIRONMENT),
      suggestedActions: [
        {
          id: 'run-preflight',
          label: 'Run environment preflight',
          description: 'Open Environment Config and run preflight to see security and compose checks.',
          priority: 'high',
        },
        {
          id: 'fix-compose-security',
          label: 'Fix compose security violations',
          description: 'Remove privileged mode, host network, or forbidden volume mounts.',
          priority: 'high',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseImagePull(context: FailureDiagnosisContext): RunDiagnosis {
    const message = sanitizeDetail(context.message || 'Docker image pull failed');
    return {
      category: 'image_pull_failed',
      title: 'Docker image pull failed',
      summary: message,
      primaryEvidence: [
        this.runFieldEvidence('Runner error', message, 'errorMessage'),
        ...this.dockerLogEvidence(context),
      ],
      relatedEvidence: this.imageReferenceEvidence(context),
      suggestedActions: [
        {
          id: 'verify-image-name',
          label: 'Verify image name and tag',
          description: 'Check image references in the environment config match a reachable registry.',
          priority: 'high',
        },
        {
          id: 'check-registry-auth',
          label: 'Check registry authentication',
          description: 'Ensure the runner can authenticate to private image registries.',
          priority: 'medium',
        },
      ],
      confidence: context.run.failureCategory === TestRunFailureCategory.IMAGE_PULL ? 0.95 : 0.75,
    };
  }

  private diagnoseContainerExited(context: FailureDiagnosisContext): RunDiagnosis {
    const message = sanitizeDetail(context.message || 'Container exited unexpectedly');
    const exitCode = extractExitCode(context.message);
    return {
      category: 'container_exited',
      title: 'Container exited before becoming healthy',
      summary: exitCode
        ? `A service container exited with code ${exitCode}.`
        : message,
      primaryEvidence: [
        this.runFieldEvidence('Runner error', message, 'errorMessage'),
        ...this.dockerLogEvidence(context),
      ],
      relatedEvidence: this.phaseEvidence(context, TestRunStatus.STARTING_ENVIRONMENT),
      suggestedActions: [
        {
          id: 'inspect-container-logs',
          label: 'Inspect container logs',
          description: 'Review DOCKER log chunks for the service that exited.',
          priority: 'high',
        },
        {
          id: 'check-start-command',
          label: 'Check service start command',
          description: 'Verify the container entrypoint and environment variables in compose.',
          priority: 'medium',
        },
      ],
      confidence: exitCode ? 0.95 : 0.75,
    };
  }

  private diagnosePortConflict(context: FailureDiagnosisContext): RunDiagnosis {
    const message = sanitizeDetail(context.message);
    const port = extractPortFromMessage(context.message);
    return {
      category: 'port_conflict',
      title: 'Host port conflict detected',
      summary: port
        ? `Port ${port} is already in use on the runner host.`
        : 'A required host port is already allocated.',
      primaryEvidence: [
        this.runFieldEvidence('Runner error', message, 'errorMessage'),
        ...this.dockerLogEvidence(context),
      ],
      relatedEvidence: this.phaseEvidence(context, TestRunStatus.STARTING_ENVIRONMENT),
      suggestedActions: [
        {
          id: 'free-port',
          label: port ? `Free port ${port}` : 'Free the conflicting host port',
          description: 'Stop the process or container currently bound to the host port.',
          priority: 'high',
        },
        {
          id: 'change-port-mapping',
          label: 'Change host port mapping',
          description: 'Update the environment config to use a different host port.',
          priority: 'medium',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseHealthcheckTimeout(context: FailureDiagnosisContext): RunDiagnosis {
    const health = context.metadata.healthcheckResult;
    const url = health?.url ?? 'health endpoint';
    const message = sanitizeDetail(
      health?.message ?? context.message ?? 'Healthcheck timed out',
    );
    return {
      category: 'healthcheck_timeout',
      title: 'Healthcheck timed out',
      summary: message,
      primaryEvidence: [
        {
          type: 'healthcheck',
          label: 'Healthcheck',
          detail: `${url}: expected ${health?.expectedStatus ?? 200}, last status ${health?.actualStatus ?? 'unknown'}`,
          ref: { phaseId: 'healthcheck' },
        },
      ],
      relatedEvidence: [
        ...this.phaseEvidence(context, TestRunStatus.WAITING_FOR_HEALTHCHECK),
        ...(health?.durationMs
          ? [
              {
                type: 'healthcheck' as const,
                label: 'Healthcheck duration',
                detail: `${health.durationMs} ms`,
                ref: { phaseId: 'healthcheck' },
              },
            ]
          : []),
      ],
      suggestedActions: [
        {
          id: 'increase-timeout',
          label: 'Increase healthcheck timeout',
          description: 'Raise healthcheckTimeoutSeconds in project settings if the service starts slowly.',
          priority: 'high',
        },
        {
          id: 'verify-health-url',
          label: 'Verify healthcheck URL',
          description: `Confirm ${url} is reachable once containers are up.`,
          priority: 'high',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseHealthcheckFailure(context: FailureDiagnosisContext): RunDiagnosis {
    const health = context.metadata.healthcheckResult;
    const message = sanitizeDetail(
      health?.message ?? context.message ?? 'Healthcheck returned unexpected status',
    );
    return {
      category: 'healthcheck_timeout',
      title: 'Healthcheck failed',
      summary: message,
      primaryEvidence: [
        {
          type: 'healthcheck',
          label: 'Healthcheck response',
          detail: `Expected ${health?.expectedStatus ?? 200}, got ${health?.actualStatus ?? 'unknown'}`,
          ref: { phaseId: 'healthcheck' },
        },
      ],
      relatedEvidence: this.phaseEvidence(context, TestRunStatus.WAITING_FOR_HEALTHCHECK),
      suggestedActions: [
        {
          id: 'check-service-readiness',
          label: 'Check service readiness',
          description: 'Ensure the application responds on the healthcheck path after startup.',
          priority: 'high',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseNetworkFailure(context: FailureDiagnosisContext): RunDiagnosis {
    const message = sanitizeDetail(context.message || 'Network connection failed');
    return {
      category: 'dns_network_failure',
      title: 'DNS or network failure',
      summary: message,
      primaryEvidence: [this.runFieldEvidence('Runner error', message, 'errorMessage')],
      relatedEvidence: this.dockerLogEvidence(context),
      suggestedActions: [
        {
          id: 'verify-dns',
          label: 'Verify DNS resolution',
          description: 'Check that service hostnames resolve inside the test environment.',
          priority: 'high',
        },
        {
          id: 'check-network-connectivity',
          label: 'Check network connectivity',
          description: 'Ensure containers can reach each other and external dependencies.',
          priority: 'medium',
        },
      ],
      confidence: context.run.failureCategory === TestRunFailureCategory.NETWORK ? 0.95 : 0.75,
    };
  }

  private diagnoseHttpTimeout(context: FailureDiagnosisContext, result: TestResult): RunDiagnosis {
    const message = sanitizeDetail(result.errorMessage ?? 'HTTP request timed out');
    return {
      category: 'http_timeout',
      title: 'HTTP request timed out',
      summary: `${result.suiteName} / ${result.testName}: ${message}`,
      primaryEvidence: [
        this.testResultEvidence('Failed step', result, message),
        {
          type: 'test_result',
          label: 'Request',
          detail: `${result.method} ${result.path}`,
          ref: { testResultId: result.id },
        },
      ],
      relatedEvidence: [],
      suggestedActions: [
        {
          id: 'increase-request-timeout',
          label: 'Increase request timeout',
          description: 'Check RUNNER_REQUEST_TIMEOUT_MS or reduce service response latency.',
          priority: 'high',
        },
        {
          id: 'verify-endpoint',
          label: 'Verify endpoint availability',
          description: `Confirm ${result.method} ${result.path} responds within the timeout.`,
          priority: 'medium',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseUnexpectedStatus(context: FailureDiagnosisContext, result: TestResult): RunDiagnosis {
    const message = sanitizeDetail(
      result.errorMessage ?? `Expected status ${result.expectedStatus}, got ${result.actualStatus}`,
    );
    return {
      category: 'unexpected_status',
      title: 'Unexpected HTTP status code',
      summary: `${result.suiteName} / ${result.testName}: ${message}`,
      primaryEvidence: [
        this.testResultEvidence('Failed step', result, message),
        {
          type: 'test_result',
          label: 'Status code',
          detail: `Expected ${result.expectedStatus}, actual ${result.actualStatus ?? 'none'}`,
          ref: { testResultId: result.id },
        },
      ],
      relatedEvidence: [],
      suggestedActions: [
        {
          id: 'compare-response',
          label: 'Compare response with baseline',
          description: 'Open the failed step response preview and compare with a passing run.',
          priority: 'high',
        },
        {
          id: 'fix-expected-status',
          label: 'Update expected status',
          description: `If ${result.actualStatus} is correct, update the step expected status.`,
          priority: 'medium',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseAssertionMismatch(context: FailureDiagnosisContext, result: TestResult): RunDiagnosis {
    const assertions = this.readAssertions(result);
    const failedAssertion = assertions.find((assertion) => !assertion.passed);
    const message = sanitizeDetail(
      failedAssertion?.message ?? result.errorMessage ?? 'Assertion did not match expected value',
    );
    return {
      category: 'assertion_mismatch',
      title: 'Assertion mismatch',
      summary: `${result.suiteName} / ${result.testName}: ${message}`,
      primaryEvidence: [
        this.testResultEvidence('Failed step', result, message),
        ...(failedAssertion
          ? [
              {
                type: 'test_result' as const,
                label: `Assertion ${failedAssertion.fieldPath}`,
                detail: `Expected ${JSON.stringify(failedAssertion.expected)}, actual ${JSON.stringify(failedAssertion.actual)}`,
                ref: { testResultId: result.id },
              },
            ]
          : []),
      ],
      relatedEvidence: [],
      suggestedActions: [
        {
          id: 'review-assertion',
          label: 'Review failing assertion',
          description: failedAssertion
            ? `Check fieldPath ${failedAssertion.fieldPath} (${failedAssertion.operator}).`
            : 'Open assertion results for the failed step.',
          priority: 'high',
        },
        {
          id: 'compare-with-baseline',
          label: 'Compare with last passing run',
          description: 'Use run comparison to see if the response shape changed.',
          priority: 'medium',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseVariableExtraction(context: FailureDiagnosisContext, result: TestResult): RunDiagnosis {
    const message = sanitizeDetail(
      result.errorMessage ?? 'Variable extraction or assignment failed',
    );
    return {
      category: 'variable_extraction_failed',
      title: 'Variable extraction failed',
      summary: `${result.suiteName} / ${result.testName}: ${message}`,
      primaryEvidence: [this.testResultEvidence('Failed step', result, message)],
      relatedEvidence: [],
      suggestedActions: [
        {
          id: 'verify-json-path',
          label: 'Verify JSON path',
          description: 'Ensure the save/extract path exists in the source step response.',
          priority: 'high',
        },
        {
          id: 'check-source-step',
          label: 'Check source step output',
          description: 'Confirm the upstream step returned the expected response body.',
          priority: 'medium',
        },
      ],
      confidence: 0.95,
    };
  }

  private diagnoseInternal(
    context: FailureDiagnosisContext,
    summary?: string,
  ): RunDiagnosis {
    const message = sanitizeDetail(
      summary ?? context.message ?? context.run.errorMessage ?? 'An internal runner error occurred',
    );
    return {
      category: 'internal_runner_error',
      title: 'Internal runner error',
      summary: message,
      primaryEvidence: [this.runFieldEvidence('Runner error', message, 'errorMessage')],
      relatedEvidence: [
        ...this.dockerLogEvidence(context),
        ...(context.run.runnerId
          ? [
              {
                type: 'run_field' as const,
                label: 'Runner ID',
                detail: context.run.runnerId,
                ref: { field: 'runnerId' },
              },
            ]
          : []),
      ],
      suggestedActions: [
        {
          id: 'check-runner-logs',
          label: 'Inspect runner logs',
          description: 'Review SYSTEM and ERROR log chunks around the failure time.',
          priority: 'high',
        },
        {
          id: 'retry-run',
          label: 'Retry the run',
          description: 'If transient, re-run with the same immutable revisions.',
          priority: 'low',
        },
      ],
      confidence: 0.5,
    };
  }

  private isCleanupOnlyFailure(context: FailureDiagnosisContext): boolean {
    return (
      Boolean(context.run.cleanupError) &&
      !context.failedResult &&
      !context.run.errorMessage &&
      !context.run.failureCategory &&
      context.run.status !== TestRunStatus.CANCELLED
    );
  }

  private isVariableExtractionFailure(result: TestResult, context: FailureDiagnosisContext): boolean {
    return VARIABLE_EXTRACTION_PATTERN.test(result.errorMessage ?? context.message);
  }

  private isHttpTimeout(result: TestResult, context: FailureDiagnosisContext): boolean {
    if (result.stepType === 'pollUntil' && TIMEOUT_PATTERN.test(result.errorMessage ?? '')) {
      return true;
    }
    return TIMEOUT_PATTERN.test(result.errorMessage ?? context.message);
  }

  private isUnexpectedStatus(result: TestResult): boolean {
    if (result.stepType !== 'apiRequest' && result.stepType !== 'pollUntil') {
      return false;
    }
    const assertions = this.readAssertions(result);
    const failedJsonAssertion = assertions.find(
      (assertion) => !assertion.passed && assertion.fieldPath !== '$.status',
    );
    if (failedJsonAssertion) {
      return false;
    }
    return (
      result.actualStatus !== undefined &&
      result.actualStatus !== result.expectedStatus &&
      !result.errorMessage?.includes('contains')
    );
  }

  private hasFailedJsonAssertion(result: TestResult): boolean {
    return this.readAssertions(result).some(
      (assertion) => !assertion.passed && assertion.fieldPath !== '$.status',
    );
  }

  private readAssertions(result: TestResult): StoredAssertionResult[] {
    if (!Array.isArray(result.assertionResults)) {
      return [];
    }
    return result.assertionResults.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return [];
      }
      const record = entry as Record<string, unknown>;
      if (typeof record.fieldPath !== 'string' || typeof record.operator !== 'string') {
        return [];
      }
      return [
        {
          fieldPath: record.fieldPath,
          operator: record.operator,
          expected: record.expected,
          actual: record.actual,
          passed: Boolean(record.passed),
          message: typeof record.message === 'string' ? record.message : undefined,
        },
      ];
    });
  }

  private runFieldEvidence(label: string, detail: string, field: string): DiagnosisEvidence {
    return {
      type: 'run_field',
      label,
      detail: sanitizeDetail(detail),
      ref: { field },
    };
  }

  private testResultEvidence(label: string, result: TestResult, detail: string): DiagnosisEvidence {
    return {
      type: 'test_result',
      label,
      detail: sanitizeDetail(detail),
      ref: { testResultId: result.id },
    };
  }

  private phaseEvidence(
    context: FailureDiagnosisContext,
    status: TestRunStatus,
  ): DiagnosisEvidence[] {
    const timestamp = context.phaseTimestamps[status];
    if (!timestamp) {
      return [];
    }
    return [
      {
        type: 'phase',
        label: `Phase ${status}`,
        detail: `Entered at ${timestamp.toISOString()}`,
        ref: { phaseId: status },
      },
    ];
  }

  private dockerLogEvidence(context: FailureDiagnosisContext): DiagnosisEvidence[] {
    return context.logPreviews
      .filter((chunk) => chunk.source === 'DOCKER' || chunk.source === 'ERROR')
      .slice(0, 3)
      .map((chunk) => ({
        type: 'log_excerpt' as const,
        label: `${chunk.source} log`,
        detail: chunk.preview,
        ref: { logChunkSequence: chunk.sequence },
      }));
  }

  private imageReferenceEvidence(context: FailureDiagnosisContext): DiagnosisEvidence[] {
    const refs = context.metadata.imageReferences ?? [];
    return refs.slice(0, 5).map((reference) => ({
      type: 'environment' as const,
      label: `Image ${reference.serviceName}`,
      detail: reference.image,
      ref: { phaseId: 'image_preparation' },
    }));
  }
}
