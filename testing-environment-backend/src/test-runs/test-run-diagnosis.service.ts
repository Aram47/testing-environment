import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TestResult,
  TestResultStatus,
  TestRun,
  TestRunFailureCategory,
  TestRunStatus,
} from '@prisma/client';
import { TEST_RUN_PHASE_STATUSES } from './test-run-status.constants';
import {
  TestRunExecutionMetadata,
} from './types/test-run-execution-metadata.types';
import {
  AssertionResultDto,
  EnvironmentResultDto,
  HealthcheckResultDto,
  InfrastructureDiagnosticsDto,
  PhaseTimelineEntryDto,
  PrimaryFailureDto,
  TestRunDiagnosisDto,
} from './dto/test-run-detail-response.dto';

type DiagnosisRun = Pick<
  TestRun,
  | 'status'
  | 'failureCategory'
  | 'statusReason'
  | 'errorMessage'
  | 'cleanupError'
  | 'runnerId'
  | 'cancellationReason'
  | 'currentPhase'
  | 'phaseTimestamps'
  | 'queuedAt'
  | 'claimedAt'
  | 'startedAt'
  | 'finishedAt'
  | 'executionMetadata'
>;

interface PhaseDefinition {
  id: string;
  label: string;
  backendStatuses: TestRunStatus[];
  startFrom?: (run: DiagnosisRun) => Date | undefined;
}

const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    id: 'queued',
    label: 'Queued',
    backendStatuses: [TestRunStatus.QUEUED, TestRunStatus.CLAIMED],
    startFrom: (run) => run.queuedAt ?? undefined,
  },
  {
    id: 'workspace',
    label: 'Workspace',
    backendStatuses: [TestRunStatus.PREPARING_WORKSPACE],
  },
  {
    id: 'validation',
    label: 'Validation',
    backendStatuses: [TestRunStatus.VALIDATING_ENVIRONMENT],
  },
  {
    id: 'image_preparation',
    label: 'Image preparation',
    backendStatuses: [TestRunStatus.PULLING_IMAGES],
  },
  {
    id: 'environment_startup',
    label: 'Environment startup',
    backendStatuses: [TestRunStatus.STARTING_ENVIRONMENT],
  },
  {
    id: 'healthcheck',
    label: 'Healthcheck',
    backendStatuses: [TestRunStatus.WAITING_FOR_HEALTHCHECK],
  },
  {
    id: 'tests',
    label: 'Tests',
    backendStatuses: [TestRunStatus.EXECUTING_TESTS],
  },
  {
    id: 'artifact_collection',
    label: 'Artifact collection',
    backendStatuses: [TestRunStatus.COLLECTING_ARTIFACTS],
  },
  {
    id: 'cleanup',
    label: 'Cleanup',
    backendStatuses: [TestRunStatus.CLEANING_UP],
  },
];

const TERMINAL_FAILURE_STATUSES: TestRunStatus[] = [
  TestRunStatus.TEST_FAILED,
  TestRunStatus.INFRA_FAILED,
  TestRunStatus.TIMED_OUT,
  TestRunStatus.CANCELLED,
];

@Injectable()
export class TestRunDiagnosisService {
  buildDiagnosis(run: DiagnosisRun, results: TestResult[]): TestRunDiagnosisDto {
    const metadata = this.readMetadata(run.executionMetadata);
    const environmentResult = this.buildEnvironmentResult(run, metadata);
    const healthcheckResult = this.buildHealthcheckResult(run, metadata);
    const infrastructure = this.buildInfrastructure(run);
    const primaryFailure = this.buildPrimaryFailure(run, results, metadata, {
      environmentResult,
      healthcheckResult,
    });
    const headline = this.buildHeadline(run, primaryFailure);

    return {
      failureCategory: run.failureCategory,
      headline,
      primaryFailure,
      environmentResult,
      healthcheckResult,
      infrastructure,
    };
  }

  buildPhaseTimeline(run: DiagnosisRun): PhaseTimelineEntryDto[] {
    const timestamps = this.readPhaseTimestamps(run.phaseTimestamps);
    const metadata = this.readMetadata(run.executionMetadata);
    const usesDockerCompose = metadata.usesDockerCompose !== false;
    const failedPhaseId = this.failedPhaseId(run);
    const activePhaseId = this.activePhaseId(run);

    const phaseStarts = PHASE_DEFINITIONS.map((definition) => {
      if (definition.id === 'queued') {
        return definition.startFrom?.(run) ?? timestamps[definition.backendStatuses[0]];
      }
      for (const status of definition.backendStatuses) {
        const timestamp = timestamps[status];
        if (timestamp) {
          return timestamp;
        }
      }
      return undefined;
    });

    return PHASE_DEFINITIONS.map((definition, index) => {
      const startedAt = phaseStarts[index];
      const nextStart = phaseStarts.slice(index + 1).find((value) => value !== undefined);
      const finishedAt =
        nextStart ??
        (definition.id === 'cleanup' && run.finishedAt ? run.finishedAt : undefined);
      const durationMs =
        startedAt && finishedAt
          ? Math.max(finishedAt.getTime() - startedAt.getTime(), 0)
          : undefined;
      const skipped =
        !usesDockerCompose &&
        ['image_preparation', 'environment_startup'].includes(definition.id) &&
        !startedAt;

      let status: PhaseTimelineEntryDto['status'] = 'pending';
      if (skipped) {
        status = 'skipped';
      } else if (definition.id === failedPhaseId) {
        status = 'failed';
      } else if (definition.id === activePhaseId) {
        status = 'active';
      } else if (startedAt && (finishedAt || this.isTerminal(run.status))) {
        status = 'completed';
      }

      return {
        id: definition.id,
        label: definition.label,
        status,
        startedAt: startedAt?.toISOString() ?? null,
        finishedAt: finishedAt?.toISOString() ?? null,
        durationMs: durationMs ?? null,
      };
    });
  }

  private buildPrimaryFailure(
    run: DiagnosisRun,
    results: TestResult[],
    metadata: TestRunExecutionMetadata,
    context: {
      environmentResult: EnvironmentResultDto;
      healthcheckResult: HealthcheckResultDto;
    },
  ): PrimaryFailureDto | null {
    if (!this.isTerminal(run.status) || run.status === TestRunStatus.PASSED) {
      return null;
    }

    if (run.status === TestRunStatus.CANCELLED) {
      return {
        kind: 'cancelled',
        phase: 'cancelled',
        message: run.cancellationReason ?? run.statusReason ?? 'Run was cancelled',
      };
    }

    if (run.failureCategory === TestRunFailureCategory.TEST_ASSERTION) {
      const failedResult = results.find((result) => result.status === TestResultStatus.FAILED);
      if (failedResult) {
        return this.primaryFailureFromTestResult(failedResult);
      }
    }

    if (
      run.failureCategory === TestRunFailureCategory.ENVIRONMENT_VALIDATION ||
      context.environmentResult.status === 'failed'
    ) {
      return {
        kind: 'environment',
        phase: 'validation',
        message:
          context.environmentResult.message ??
          run.errorMessage ??
          run.statusReason ??
          'Environment validation failed',
      };
    }

    if (
      run.failureCategory === TestRunFailureCategory.HEALTHCHECK ||
      context.healthcheckResult.status === 'failed'
    ) {
      return {
        kind: 'healthcheck',
        phase: 'healthcheck',
        message:
          context.healthcheckResult.message ??
          run.errorMessage ??
          run.statusReason ??
          'Healthcheck failed',
        expected: context.healthcheckResult.expectedStatus,
        actual: context.healthcheckResult.actualStatus,
      };
    }

    const failedResult = results.find((result) => result.status === TestResultStatus.FAILED);
    if (failedResult) {
      return this.primaryFailureFromTestResult(failedResult);
    }

    return {
      kind: 'infrastructure',
      phase: run.currentPhase ?? 'infrastructure',
      message: run.errorMessage ?? run.statusReason ?? 'Run failed before tests completed',
    };
  }

  private primaryFailureFromTestResult(result: TestResult): PrimaryFailureDto {
    const assertions = this.readAssertions(result.assertionResults);
    const failedAssertion = assertions.find((assertion) => !assertion.passed);
    return {
      kind: 'test_step',
      phase: 'tests',
      testResultId: result.id,
      stepId: result.stepId ?? undefined,
      suiteName: result.suiteName,
      testName: result.testName,
      message: result.errorMessage ?? failedAssertion?.message ?? 'Test step failed',
      expected: failedAssertion?.expected ?? result.expectedStatus,
      actual: failedAssertion?.actual ?? result.actualStatus,
      assertions,
    };
  }

  private buildHeadline(run: DiagnosisRun, primaryFailure: PrimaryFailureDto | null): string {
    if (run.status === TestRunStatus.PASSED) {
      return 'All tests passed';
    }
    if (primaryFailure?.message) {
      return primaryFailure.message;
    }
    if (run.statusReason) {
      return run.statusReason;
    }
    if (run.errorMessage) {
      return run.errorMessage;
    }
    return `Run finished with status ${run.status}`;
  }

  private buildEnvironmentResult(
    run: DiagnosisRun,
    metadata: TestRunExecutionMetadata,
  ): EnvironmentResultDto {
    if (metadata.environmentResult) {
      return metadata.environmentResult;
    }
    if (run.failureCategory === TestRunFailureCategory.ENVIRONMENT_VALIDATION) {
      return {
        status: 'failed',
        validationPassed: false,
        message: run.errorMessage ?? run.statusReason ?? undefined,
      };
    }
    if (this.hasReachedPhase(run, TestRunStatus.VALIDATING_ENVIRONMENT)) {
      return { status: 'passed', validationPassed: true };
    }
    if (metadata.usesDockerCompose === false) {
      return { status: 'skipped', validationPassed: true };
    }
    return { status: 'not_reached' };
  }

  private buildHealthcheckResult(
    run: DiagnosisRun,
    metadata: TestRunExecutionMetadata,
  ): HealthcheckResultDto {
    if (metadata.healthcheckResult) {
      return metadata.healthcheckResult;
    }
    if (run.failureCategory === TestRunFailureCategory.HEALTHCHECK) {
      return {
        status: 'failed',
        message: run.errorMessage ?? run.statusReason ?? undefined,
      };
    }
    if (this.hasReachedPhase(run, TestRunStatus.EXECUTING_TESTS) || run.status === TestRunStatus.PASSED) {
      return { status: 'passed' };
    }
    if (metadata.usesDockerCompose === false && !this.hasReachedPhase(run, TestRunStatus.WAITING_FOR_HEALTHCHECK)) {
      return { status: 'not_reached' };
    }
    return { status: 'not_reached' };
  }

  private buildInfrastructure(run: DiagnosisRun): InfrastructureDiagnosticsDto {
    return {
      cleanupError: run.cleanupError,
      runnerId: run.runnerId,
      errorMessage: run.errorMessage,
    };
  }

  private readMetadata(value: Prisma.JsonValue | null): TestRunExecutionMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as TestRunExecutionMetadata;
  }

  private readPhaseTimestamps(value: Prisma.JsonValue | null): Partial<Record<TestRunStatus, Date>> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([status, timestamp]) => [status as TestRunStatus, new Date(timestamp)]),
    );
  }

  private readAssertions(value: Prisma.JsonValue | null): AssertionResultDto[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.flatMap((entry) => {
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
          message: typeof record.message === 'string' ? record.message : null,
        },
      ];
    });
  }

  private isTerminal(status: TestRunStatus): boolean {
    return (
      status === TestRunStatus.PASSED ||
      TERMINAL_FAILURE_STATUSES.includes(status)
    );
  }

  private hasReachedPhase(run: DiagnosisRun, status: TestRunStatus): boolean {
    const timestamps = this.readPhaseTimestamps(run.phaseTimestamps);
    if (timestamps[status]) {
      return true;
    }
    const currentIndex = TEST_RUN_PHASE_STATUSES.indexOf(run.status as (typeof TEST_RUN_PHASE_STATUSES)[number]);
    const targetIndex = TEST_RUN_PHASE_STATUSES.indexOf(status as (typeof TEST_RUN_PHASE_STATUSES)[number]);
    if (currentIndex >= 0 && targetIndex >= 0) {
      return currentIndex > targetIndex;
    }
    return (
      run.status === TestRunStatus.PASSED ||
      (TERMINAL_FAILURE_STATUSES.includes(run.status) && targetIndex >= 0)
    );
  }

  private failedPhaseId(run: DiagnosisRun): string | undefined {
    if (!TERMINAL_FAILURE_STATUSES.includes(run.status)) {
      return undefined;
    }
    if (run.failureCategory === TestRunFailureCategory.ENVIRONMENT_VALIDATION) {
      return 'validation';
    }
    if (
      run.failureCategory === TestRunFailureCategory.IMAGE_PULL ||
      run.failureCategory === TestRunFailureCategory.CONTAINER_START
    ) {
      return run.failureCategory === TestRunFailureCategory.IMAGE_PULL
        ? 'image_preparation'
        : 'environment_startup';
    }
    if (run.failureCategory === TestRunFailureCategory.HEALTHCHECK) {
      return 'healthcheck';
    }
    if (run.failureCategory === TestRunFailureCategory.TEST_ASSERTION) {
      return 'tests';
    }
    const timestamps = this.readPhaseTimestamps(run.phaseTimestamps);
    const lastPhase = [...PHASE_DEFINITIONS]
      .reverse()
      .find((definition) =>
        definition.backendStatuses.some((status) => timestamps[status] !== undefined),
      );
    return lastPhase?.id;
  }

  private activePhaseId(run: DiagnosisRun): string | undefined {
    if (this.isTerminal(run.status)) {
      return undefined;
    }
    const mapping: Partial<Record<TestRunStatus, string>> = {
      [TestRunStatus.QUEUED]: 'queued',
      [TestRunStatus.CLAIMED]: 'queued',
      [TestRunStatus.PREPARING_WORKSPACE]: 'workspace',
      [TestRunStatus.VALIDATING_ENVIRONMENT]: 'validation',
      [TestRunStatus.PULLING_IMAGES]: 'image_preparation',
      [TestRunStatus.STARTING_ENVIRONMENT]: 'environment_startup',
      [TestRunStatus.WAITING_FOR_HEALTHCHECK]: 'healthcheck',
      [TestRunStatus.EXECUTING_TESTS]: 'tests',
      [TestRunStatus.COLLECTING_ARTIFACTS]: 'artifact_collection',
      [TestRunStatus.CLEANING_UP]: 'cleanup',
    };
    return mapping[run.status];
  }
}
