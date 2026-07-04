import { TestRunQueueService } from './test-run-queue.service';

describe('TestRunQueueService', () => {
  it('uses deterministic job ids so duplicate enqueue cannot create independent execution', async () => {
    const queue = {
      add: jest.fn(() => Promise.resolve()),
    };
    const prisma = {
      testRun: {
        update: jest.fn(() => Promise.resolve()),
      },
    };
    const service = new TestRunQueueService(queue as never, prisma as never);

    await service.enqueue('run-1');
    await service.enqueue('run-1');

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenNthCalledWith(
      1,
      'execute-test-run',
      { testRunId: 'run-1' },
      { jobId: 'test-run:run-1' },
    );
    expect(queue.add).toHaveBeenNthCalledWith(
      2,
      'execute-test-run',
      { testRunId: 'run-1' },
      { jobId: 'test-run:run-1' },
    );
  });
});
