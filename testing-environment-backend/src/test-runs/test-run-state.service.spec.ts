import { ConflictException } from '@nestjs/common';
import { TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TEST_RUN_ALLOWED_TRANSITIONS, TestRunStateService } from './test-run-state.service';

describe('TestRunStateService', () => {
  const statuses = Object.values(TestRunStatus);
  const terminalStatuses: TestRunStatus[] = [
    TestRunStatus.PASSED,
    TestRunStatus.TEST_FAILED,
    TestRunStatus.INFRA_FAILED,
    TestRunStatus.TIMED_OUT,
    TestRunStatus.CANCELLED,
  ];

  it('allows exactly the configured non-terminal transitions', () => {
    const service = new TestRunStateService({} as PrismaService);

    for (const from of statuses) {
      for (const to of statuses) {
        const expected =
          !terminalStatuses.includes(from) &&
          (from === to || TEST_RUN_ALLOWED_TRANSITIONS[from].includes(to));

        expect(service.canTransition(from, to)).toBe(expected);
      }
    }
  });

  it('persists queued metadata through the state service', async () => {
    const prisma = createPrismaMock(TestRunStatus.CREATED);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await service.markQueued('run-1', 'test-run:run-1');

    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TestRunStatus.CREATED },
      data: expect.objectContaining({
        status: TestRunStatus.QUEUED,
        queueJobId: 'test-run:run-1',
        queuedAt: expect.any(Date),
        enqueuedAt: expect.any(Date),
      }),
    });
  });

  it('persists cancellation requester and reason in durable fields', async () => {
    const prisma = createPrismaMock(TestRunStatus.EXECUTING_TESTS);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await service.requestCancel('run-1', 'user-1', 'deploy rollback');

    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TestRunStatus.EXECUTING_TESTS },
      data: expect.objectContaining({
        status: TestRunStatus.CANCEL_REQUESTED,
        cancelRequestedAt: expect.any(Date),
        cancellationRequestedAt: expect.any(Date),
        cancelRequestedBy: 'user-1',
        cancellationReason: 'deploy rollback',
      }),
    });
  });

  it('acquires an execution lease while claiming a queued run', async () => {
    const prisma = createPrismaMock(TestRunStatus.QUEUED);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await service.claim('run-1', { runnerId: 'runner-1', leaseDurationMs: 60000 });

    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'run-1',
        status: TestRunStatus.QUEUED,
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: expect.any(Date) } }],
      },
      data: expect.objectContaining({
        status: TestRunStatus.CLAIMED,
        runnerId: 'runner-1',
        leaseAcquiredAt: expect.any(Date),
        leaseExpiresAt: expect.any(Date),
        heartbeatAt: expect.any(Date),
        attempt: { increment: 1 },
      }),
    });
  });

  it('rejects claim when an active lease exists', async () => {
    const prisma = createPrismaMock(TestRunStatus.QUEUED);
    prisma.testRun.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await expect(
      service.claim('run-1', { runnerId: 'runner-2', leaseDurationMs: 60000 }),
    ).rejects.toThrow(ConflictException);
  });

  it('renews heartbeat and lease only for the owning runner', async () => {
    const prisma = createPrismaMock(TestRunStatus.EXECUTING_TESTS);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await expect(service.renewLease('run-1', 'runner-1', 60000)).resolves.toBe(true);

    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'run-1',
        runnerId: 'runner-1',
        finishedAt: null,
      }),
      data: {
        heartbeatAt: expect.any(Date),
        leaseExpiresAt: expect.any(Date),
      },
    });
  });

  it('stores cleanup errors while finalizing cancellation', async () => {
    const prisma = createPrismaMock(TestRunStatus.CANCEL_REQUESTED);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await service.markCancelled('run-1', 250, 'docker compose down failed');

    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TestRunStatus.CANCEL_REQUESTED },
      data: expect.objectContaining({
        status: TestRunStatus.CANCELLED,
        cleanupError: 'docker compose down failed',
        runnerId: null,
        leaseExpiresAt: null,
      }),
    });
  });

  it('stores assertion failures as TEST_FAILED with TEST_ASSERTION category', async () => {
    const prisma = createPrismaMock(TestRunStatus.CLEANING_UP);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await service.markTestFailed(
      'run-1',
      { totalTests: 2, passedTests: 1, failedTests: 1 },
      1200,
      '1 test assertion(s) failed',
    );

    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TestRunStatus.CLEANING_UP },
      data: expect.objectContaining({
        status: TestRunStatus.TEST_FAILED,
        failureCategory: TestRunFailureCategory.TEST_ASSERTION,
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
      }),
    });
  });

  it('stores infrastructure failures with the provided category', async () => {
    const prisma = createPrismaMock(TestRunStatus.STARTING_ENVIRONMENT);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await service.markInfraFailed(
      'run-1',
      TestRunFailureCategory.CONTAINER_START,
      'container failed',
      500,
    );

    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TestRunStatus.STARTING_ENVIRONMENT },
      data: expect.objectContaining({
        status: TestRunStatus.INFRA_FAILED,
        failureCategory: TestRunFailureCategory.CONTAINER_START,
        statusReason: 'container failed',
      }),
    });
  });

  it('rejects invalid persisted transitions', async () => {
    const prisma = createPrismaMock(TestRunStatus.CREATED);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await expect(service.enterPhase('run-1', TestRunStatus.EXECUTING_TESTS)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.testRun.updateMany).not.toHaveBeenCalled();
  });

  it('keeps terminal states immutable', async () => {
    const prisma = createPrismaMock(TestRunStatus.PASSED);
    const service = new TestRunStateService(prisma as unknown as PrismaService);

    await expect(
      service.markInfraFailed('run-1', TestRunFailureCategory.INTERNAL, 'late worker failure'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.testRun.updateMany).not.toHaveBeenCalled();
  });
});

function createPrismaMock(initialStatus: TestRunStatus) {
  let status = initialStatus;
  const run = {
    id: 'run-1',
    get status() {
      return status;
    },
    phaseTimestamps: null,
    startedAt: null,
    finishedAt: null,
  };

  return {
    testRun: {
      findUnique: jest.fn(() => Promise.resolve(run)),
      updateMany: jest.fn(({ data }: { data: { status: TestRunStatus } }) => {
        status = data.status;
        return Promise.resolve({ count: 1 });
      }),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(run)),
    },
  };
}
