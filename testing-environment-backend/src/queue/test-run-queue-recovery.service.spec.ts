import { ConfigService } from '@nestjs/config';
import { TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { TestRunQueueService } from './test-run-queue.service';
import { TestRunQueueRecoveryService } from './test-run-queue-recovery.service';

describe('TestRunQueueRecoveryService', () => {
  it('re-enqueues created runs that were not cancelled', async () => {
    const prisma = {
      testRun: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'run-1', status: TestRunStatus.CREATED }])
          .mockResolvedValueOnce([]),
      },
    };
    const queue = {
      enqueue: jest.fn(() => Promise.resolve('test-run:run-1')),
      hasJob: jest.fn(),
      restoreMissingQueuedJob: jest.fn(),
    };
    const service = createService(prisma, queue);

    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(queue.enqueue).toHaveBeenCalledWith('run-1');
    expect(queue.hasJob).not.toHaveBeenCalled();
    expect(queue.restoreMissingQueuedJob).not.toHaveBeenCalled();
  });

  it('restores queued runs only when the BullMQ job is missing', async () => {
    const prisma = {
      testRun: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'run-1', status: TestRunStatus.QUEUED }])
          .mockResolvedValueOnce([]),
      },
    };
    const queue = {
      enqueue: jest.fn(),
      hasJob: jest.fn(() => Promise.resolve(false)),
      restoreMissingQueuedJob: jest.fn(() => Promise.resolve('test-run:run-1')),
    };
    const service = createService(prisma, queue);

    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(queue.hasJob).toHaveBeenCalledWith('run-1');
    expect(queue.restoreMissingQueuedJob).toHaveBeenCalledWith('run-1');
  });

  it('does not touch queued runs that still have a BullMQ job', async () => {
    const prisma = {
      testRun: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'run-1', status: TestRunStatus.QUEUED }])
          .mockResolvedValueOnce([]),
      },
    };
    const queue = {
      enqueue: jest.fn(),
      hasJob: jest.fn(() => Promise.resolve(true)),
      restoreMissingQueuedJob: jest.fn(),
    };
    const service = createService(prisma, queue);

    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(queue.hasJob).toHaveBeenCalledWith('run-1');
    expect(queue.restoreMissingQueuedJob).not.toHaveBeenCalled();
  });

  it('marks expired execution leases as infrastructure failures without retrying', async () => {
    const prisma = {
      testRun: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'run-1', status: TestRunStatus.EXECUTING_TESTS }]),
      },
    };
    const state = {
      tryMarkInfraFailed: jest.fn(() => Promise.resolve({ id: 'run-1' })),
      tryMarkCancelled: jest.fn(),
    };
    const service = createService(prisma, undefined, state);

    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(state.tryMarkInfraFailed).toHaveBeenCalledWith(
      'run-1',
      TestRunFailureCategory.INTERNAL,
      'Worker execution lease expired; run was not retried automatically',
    );
  });

  it('finalizes expired cancellation leases as cancelled', async () => {
    const prisma = {
      testRun: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'run-1', status: TestRunStatus.CANCEL_REQUESTED }]),
      },
    };
    const state = {
      tryMarkInfraFailed: jest.fn(),
      tryMarkCancelled: jest.fn(() => Promise.resolve({ id: 'run-1' })),
    };
    const service = createService(prisma, undefined, state);

    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(state.tryMarkCancelled).toHaveBeenCalledWith(
      'run-1',
      undefined,
      'Worker lease expired before cleanup confirmation',
    );
    expect(state.tryMarkInfraFailed).not.toHaveBeenCalled();
  });
});

function createService(
  prisma: unknown,
  queue: unknown = { enqueue: jest.fn(), hasJob: jest.fn(), restoreMissingQueuedJob: jest.fn() },
  state: unknown = { tryMarkInfraFailed: jest.fn(), tryMarkCancelled: jest.fn() },
) {
  return new TestRunQueueRecoveryService(
    prisma as PrismaService,
    queue as TestRunQueueService,
    state as TestRunStateService,
    { get: jest.fn((_key: string, fallback: unknown) => fallback) } as unknown as ConfigService,
    { recordStuckRun: jest.fn() } as unknown as MetricsService,
  );
}
