import { TestRunFailureCategory } from '@prisma/client';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { RunnerOrchestratorService } from './runner-orchestrator.service';
import { TestRunWorkerProcessor } from './test-run-worker.processor';

describe('TestRunWorkerProcessor', () => {
  it('runs the orchestrator for claimed jobs', async () => {
    const orchestrator = { execute: jest.fn(() => Promise.resolve()) };
    const processor = new TestRunWorkerProcessor(
      orchestrator as unknown as RunnerOrchestratorService,
      {} as TestRunStateService,
    );

    await processor.process({ data: { testRunId: 'run-1' } } as never);

    expect(orchestrator.execute).toHaveBeenCalledWith('run-1');
  });

  it('marks a run failed when the final worker attempt fails', async () => {
    const state = {
      markInfraFailed: jest.fn(() => Promise.resolve({ id: 'run-1' })),
    };
    const processor = new TestRunWorkerProcessor(
      { execute: jest.fn() } as unknown as RunnerOrchestratorService,
      state as unknown as TestRunStateService,
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

    expect(state.markInfraFailed).toHaveBeenCalledWith(
      'run-1',
      TestRunFailureCategory.INTERNAL,
      'container crashed',
    );
  });
});
