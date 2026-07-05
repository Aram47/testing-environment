import { TestRunStatus } from '@prisma/client';
import { ExecutionContextService } from '../observability/execution-context.service';
import { TracingService } from '../observability/tracing.service';
import { TestRunQueueService } from './test-run-queue.service';

describe('TestRunQueueService', () => {
  it('uses deterministic job ids so duplicate enqueue cannot create independent execution', async () => {
    const queue = {
      add: jest.fn(() => Promise.resolve()),
    };
    const state = {
      getQueueState: jest
        .fn()
        .mockResolvedValueOnce(createQueueState(TestRunStatus.CREATED))
        .mockResolvedValueOnce(createQueueState(TestRunStatus.QUEUED, 'test-run:run-1')),
      markQueuedIfCreated: jest.fn(() => Promise.resolve()),
    };
    const service = createService(queue, state);

    await service.enqueue('run-1');
    await service.enqueue('run-1');

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'execute-test-run',
      {
        testRunId: 'run-1',
        context: { requestId: 'request-1', runId: 'run-1', jobId: 'test-run:run-1' },
      },
      { jobId: 'test-run:run-1' },
    );
    expect(state.markQueuedIfCreated).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite durable queue timestamps for an already queued run', async () => {
    const queue = {
      add: jest.fn(() => Promise.resolve()),
    };
    const state = {
      getQueueState: jest.fn(() =>
        Promise.resolve(createQueueState(TestRunStatus.QUEUED, 'test-run:run-1')),
      ),
      markQueuedIfCreated: jest.fn(),
    };
    const service = createService(queue, state);

    await expect(service.enqueue('run-1')).resolves.toBe('test-run:run-1');

    expect(queue.add).not.toHaveBeenCalled();
    expect(state.markQueuedIfCreated).not.toHaveBeenCalled();
  });

  it('does not enqueue terminal runs', async () => {
    const queue = {
      add: jest.fn(() => Promise.resolve()),
    };
    const state = {
      getQueueState: jest.fn(() =>
        Promise.resolve(createQueueState(TestRunStatus.INFRA_FAILED, 'test-run:run-1')),
      ),
      markQueuedIfCreated: jest.fn(),
    };
    const service = createService(queue, state);

    await expect(service.enqueue('run-1')).resolves.toBe('test-run:run-1');

    expect(queue.add).not.toHaveBeenCalled();
    expect(state.markQueuedIfCreated).not.toHaveBeenCalled();
  });

  it('restores a missing BullMQ job for an existing queued run without touching timestamps', async () => {
    const queue = {
      add: jest.fn(() => Promise.resolve()),
    };
    const state = {
      getQueueState: jest.fn(() =>
        Promise.resolve(createQueueState(TestRunStatus.QUEUED, 'test-run:run-1')),
      ),
      markQueuedIfCreated: jest.fn(),
    };
    const service = createService(queue, state);

    await expect(service.restoreMissingQueuedJob('run-1')).resolves.toBe('test-run:run-1');

    expect(queue.add).toHaveBeenCalledWith(
      'execute-test-run',
      {
        testRunId: 'run-1',
        context: { requestId: 'request-1', runId: 'run-1', jobId: 'test-run:run-1' },
      },
      { jobId: 'test-run:run-1' },
    );
    expect(state.markQueuedIfCreated).not.toHaveBeenCalled();
  });
});

function createService(queue: unknown, state: unknown): TestRunQueueService {
  return new TestRunQueueService(
    queue as never,
    state as never,
    {
      snapshot: jest.fn((context: Record<string, string>) => ({
        requestId: 'request-1',
        ...context,
      })),
    } as unknown as ExecutionContextService,
    {
      span: jest.fn((_name: string, _attrs: unknown, callback: () => Promise<unknown>) =>
        callback(),
      ),
    } as unknown as TracingService,
  );
}

function createQueueState(status: TestRunStatus, queueJobId: string | null = null) {
  return {
    id: 'run-1',
    status,
    queueJobId,
    cancelRequestedAt: null,
    cancellationRequestedAt: null,
    finishedAt: null,
  };
}
