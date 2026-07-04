import { ConfigService } from '@nestjs/config';
import { TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { TestRunQueueService } from './test-run-queue.service';
import { TestRunQueueRecoveryService } from './test-run-queue-recovery.service';

describe('TestRunQueueRecoveryService', () => {
  it('re-enqueues created and queued runs that were not cancelled', async () => {
    const prisma = {
      testRun: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'run-1' }])
          .mockResolvedValueOnce([]),
      },
    };
    const queue = { enqueue: jest.fn(() => Promise.resolve('test-run:run-1')) };
    const service = createService(prisma, queue);

    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(queue.enqueue).toHaveBeenCalledWith('run-1');
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
      markInfraFailed: jest.fn(() => Promise.resolve({ id: 'run-1' })),
      markCancelled: jest.fn(),
    };
    const service = createService(prisma, undefined, state);

    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(state.markInfraFailed).toHaveBeenCalledWith(
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
      markInfraFailed: jest.fn(),
      markCancelled: jest.fn(() => Promise.resolve({ id: 'run-1' })),
    };
    const service = createService(prisma, undefined, state);

    await service.onApplicationBootstrap();
    service.onModuleDestroy();

    expect(state.markCancelled).toHaveBeenCalledWith(
      'run-1',
      undefined,
      'Worker lease expired before cleanup confirmation',
    );
    expect(state.markInfraFailed).not.toHaveBeenCalled();
  });
});

function createService(
  prisma: unknown,
  queue: unknown = { enqueue: jest.fn() },
  state: unknown = { markInfraFailed: jest.fn(), markCancelled: jest.fn() },
) {
  return new TestRunQueueRecoveryService(
    prisma as PrismaService,
    queue as TestRunQueueService,
    state as TestRunStateService,
    { get: jest.fn((_key: string, fallback: unknown) => fallback) } as unknown as ConfigService,
  );
}
