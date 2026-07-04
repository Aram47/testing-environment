import { TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RunnerOrchestratorService } from './runner-orchestrator.service';
import { TestRunWorkerProcessor } from './test-run-worker.processor';

describe('TestRunWorkerProcessor', () => {
  it('runs the orchestrator for claimed jobs', async () => {
    const orchestrator = { execute: jest.fn(() => Promise.resolve()) };
    const processor = new TestRunWorkerProcessor(
      orchestrator as unknown as RunnerOrchestratorService,
      {} as PrismaService,
    );

    await processor.process({ data: { testRunId: 'run-1' } } as never);

    expect(orchestrator.execute).toHaveBeenCalledWith('run-1');
  });

  it('marks a run failed when the final worker attempt fails', async () => {
    const prisma = {
      testRun: {
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
    };
    const processor = new TestRunWorkerProcessor(
      { execute: jest.fn() } as unknown as RunnerOrchestratorService,
      prisma as unknown as PrismaService,
    );

    await processor.onFailed(
      {
        id: 'test-run:run-1',
        data: { testRunId: 'run-1' },
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as never,
      new Error('container crashed'),
    );

    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'run-1',
        status: { in: [TestRunStatus.PENDING, TestRunStatus.RUNNING] },
      },
      data: expect.objectContaining({
        status: TestRunStatus.FAILED,
        errorMessage: 'container crashed',
      }),
    });
  });
});
