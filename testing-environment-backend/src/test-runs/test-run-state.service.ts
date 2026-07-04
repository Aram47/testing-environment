import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TestRun, TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TEST_RUN_CANCELLABLE_STATUSES,
  TEST_RUN_PHASE_STATUSES,
  isPhaseTestRunStatus,
  isTerminalTestRunStatus,
} from './test-run-status.constants';

interface TransitionOptions {
  reason?: string;
  failureCategory?: TestRunFailureCategory;
  stats?: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
  };
  durationMs?: number;
}

type TestRunStateRecord = Pick<
  TestRun,
  'id' | 'status' | 'phaseTimestamps' | 'startedAt' | 'finishedAt'
>;

export const TEST_RUN_ALLOWED_TRANSITIONS: Readonly<
  Record<TestRunStatus, readonly TestRunStatus[]>
> = {
  [TestRunStatus.CREATED]: [TestRunStatus.QUEUED, TestRunStatus.INFRA_FAILED],
  [TestRunStatus.QUEUED]: [
    TestRunStatus.CLAIMED,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.INFRA_FAILED,
  ],
  [TestRunStatus.CLAIMED]: [
    TestRunStatus.PREPARING_WORKSPACE,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.INFRA_FAILED,
  ],
  [TestRunStatus.PREPARING_WORKSPACE]: [
    TestRunStatus.VALIDATING_ENVIRONMENT,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.INFRA_FAILED,
  ],
  [TestRunStatus.VALIDATING_ENVIRONMENT]: [
    TestRunStatus.PULLING_IMAGES,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.INFRA_FAILED,
  ],
  [TestRunStatus.PULLING_IMAGES]: [
    TestRunStatus.STARTING_ENVIRONMENT,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.INFRA_FAILED,
  ],
  [TestRunStatus.STARTING_ENVIRONMENT]: [
    TestRunStatus.WAITING_FOR_HEALTHCHECK,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.INFRA_FAILED,
  ],
  [TestRunStatus.WAITING_FOR_HEALTHCHECK]: [
    TestRunStatus.EXECUTING_TESTS,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.INFRA_FAILED,
    TestRunStatus.TIMED_OUT,
  ],
  [TestRunStatus.EXECUTING_TESTS]: [
    TestRunStatus.COLLECTING_ARTIFACTS,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.TEST_FAILED,
    TestRunStatus.TIMED_OUT,
    TestRunStatus.INFRA_FAILED,
  ],
  [TestRunStatus.COLLECTING_ARTIFACTS]: [
    TestRunStatus.CLEANING_UP,
    TestRunStatus.CANCEL_REQUESTED,
    TestRunStatus.INFRA_FAILED,
  ],
  [TestRunStatus.CLEANING_UP]: [
    TestRunStatus.PASSED,
    TestRunStatus.TEST_FAILED,
    TestRunStatus.INFRA_FAILED,
    TestRunStatus.CANCELLED,
  ],
  [TestRunStatus.CANCEL_REQUESTED]: [TestRunStatus.CANCELLED],
  [TestRunStatus.PASSED]: [],
  [TestRunStatus.TEST_FAILED]: [],
  [TestRunStatus.INFRA_FAILED]: [],
  [TestRunStatus.TIMED_OUT]: [],
  [TestRunStatus.CANCELLED]: [],
};

@Injectable()
export class TestRunStateService {
  constructor(private readonly prisma: PrismaService) {}

  get activeStatuses(): readonly TestRunStatus[] {
    return [
      TestRunStatus.CREATED,
      TestRunStatus.QUEUED,
      TestRunStatus.CLAIMED,
      ...TEST_RUN_PHASE_STATUSES,
      TestRunStatus.CANCEL_REQUESTED,
    ];
  }

  get cancellableStatuses(): readonly TestRunStatus[] {
    return TEST_RUN_CANCELLABLE_STATUSES;
  }

  isTerminal(status: TestRunStatus): boolean {
    return isTerminalTestRunStatus(status);
  }

  canTransition(from: TestRunStatus, to: TestRunStatus): boolean {
    if (isTerminalTestRunStatus(from)) {
      return false;
    }
    return from === to || TEST_RUN_ALLOWED_TRANSITIONS[from].includes(to);
  }

  async markQueued(testRunId: string, queueJobId: string): Promise<TestRun> {
    const now = new Date();
    return this.transition(testRunId, TestRunStatus.QUEUED, {
      queueJobId,
      queuedAt: now,
      enqueuedAt: now,
      statusReason: null,
      failureCategory: null,
    });
  }

  async claim(testRunId: string): Promise<TestRun> {
    const now = new Date();
    return this.transition(testRunId, TestRunStatus.CLAIMED, {
      claimedAt: now,
      startedAt: now,
      statusReason: null,
      failureCategory: null,
    });
  }

  async enterPhase(testRunId: string, phase: TestRunStatus): Promise<TestRun> {
    if (!isPhaseTestRunStatus(phase)) {
      throw new ConflictException(`${phase} is not an execution phase`);
    }
    return this.transition(testRunId, phase, {});
  }

  async requestCancel(testRunId: string): Promise<TestRun> {
    return this.transition(testRunId, TestRunStatus.CANCEL_REQUESTED, {
      cancellationRequestedAt: new Date(),
      statusReason: 'Cancellation requested',
    });
  }

  async markCancelled(testRunId: string, durationMs?: number): Promise<TestRun> {
    return this.transition(testRunId, TestRunStatus.CANCELLED, {
      finishedAt: new Date(),
      durationMs,
      failureCategory: TestRunFailureCategory.CANCELLED,
      statusReason: 'Test run was cancelled',
      errorMessage: 'Test run was cancelled',
    });
  }

  async markPassed(
    testRunId: string,
    stats: NonNullable<TransitionOptions['stats']>,
    durationMs: number,
  ): Promise<TestRun> {
    return this.transition(testRunId, TestRunStatus.PASSED, {
      finishedAt: new Date(),
      durationMs,
      errorMessage: null,
      statusReason: null,
      failureCategory: null,
      ...stats,
    });
  }

  async markTestFailed(
    testRunId: string,
    stats: NonNullable<TransitionOptions['stats']>,
    durationMs: number,
    reason: string,
  ): Promise<TestRun> {
    return this.transition(testRunId, TestRunStatus.TEST_FAILED, {
      finishedAt: new Date(),
      durationMs,
      statusReason: reason,
      errorMessage: reason,
      failureCategory: TestRunFailureCategory.TEST_ASSERTION,
      ...stats,
    });
  }

  async markInfraFailed(
    testRunId: string,
    category: TestRunFailureCategory,
    reason: string,
    durationMs?: number,
  ): Promise<TestRun> {
    return this.transition(testRunId, TestRunStatus.INFRA_FAILED, {
      finishedAt: new Date(),
      durationMs,
      statusReason: reason,
      errorMessage: reason,
      failureCategory: category,
    });
  }

  async markTimedOut(testRunId: string, reason: string, durationMs?: number): Promise<TestRun> {
    return this.transition(testRunId, TestRunStatus.TIMED_OUT, {
      finishedAt: new Date(),
      durationMs,
      statusReason: reason,
      errorMessage: reason,
      failureCategory: TestRunFailureCategory.TIMEOUT,
    });
  }

  private async transition(
    testRunId: string,
    targetStatus: TestRunStatus,
    data: Prisma.TestRunUpdateInput,
  ): Promise<TestRun> {
    const run = await this.prisma.testRun.findUnique({
      where: { id: testRunId },
      select: {
        id: true,
        status: true,
        phaseTimestamps: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    this.assertTransitionAllowed(run, targetStatus);

    const now = new Date();
    const updateData: Prisma.TestRunUpdateInput = {
      ...data,
      status: targetStatus,
      currentPhase: isPhaseTestRunStatus(targetStatus) ? targetStatus : null,
      phaseTimestamps: this.nextPhaseTimestamps(run, targetStatus, now),
    };

    const updated = await this.prisma.testRun.updateMany({
      where: { id: testRunId, status: run.status },
      data: updateData,
    });
    if (updated.count === 0) {
      throw new ConflictException('Test run status changed concurrently');
    }

    return this.prisma.testRun.findUniqueOrThrow({ where: { id: testRunId } });
  }

  private assertTransitionAllowed(run: TestRunStateRecord, targetStatus: TestRunStatus): void {
    if (isTerminalTestRunStatus(run.status)) {
      throw new ConflictException(`Cannot transition terminal test run from ${run.status}`);
    }
    if (run.status === targetStatus) {
      return;
    }
    if (!TEST_RUN_ALLOWED_TRANSITIONS[run.status].includes(targetStatus)) {
      throw new ConflictException(
        `Invalid test run status transition: ${run.status} -> ${targetStatus}`,
      );
    }
  }

  private nextPhaseTimestamps(
    run: TestRunStateRecord,
    targetStatus: TestRunStatus,
    now: Date,
  ): Prisma.InputJsonValue | undefined {
    if (!isPhaseTestRunStatus(targetStatus)) {
      return undefined;
    }

    const existing =
      run.phaseTimestamps &&
      typeof run.phaseTimestamps === 'object' &&
      !Array.isArray(run.phaseTimestamps)
        ? Object.fromEntries(
            Object.entries(run.phaseTimestamps).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {};

    return {
      ...existing,
      [targetStatus]: existing[targetStatus] ?? now.toISOString(),
    };
  }
}
