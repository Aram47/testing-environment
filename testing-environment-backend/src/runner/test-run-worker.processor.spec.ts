import { TestRunFailureCategory } from '@prisma/client';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { RunnerOrchestratorService } from './runner-orchestrator.service';
import { resolveWorkerMaxStalledCount, TestRunWorkerProcessor } from './test-run-worker.processor';

describe('TestRunWorkerProcessor', () => {
  it('defaults stalled job recovery to fail-fast', () => {
    expect(resolveWorkerMaxStalledCount()).toBe(0);
    expect(resolveWorkerMaxStalledCount('2')).toBe(2);
    expect(resolveWorkerMaxStalledCount('invalid')).toBe(0);
  });

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
      tryMarkInfraFailed: jest.fn(() => Promise.resolve({ id: 'run-1' })),
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

    expect(state.tryMarkInfraFailed).toHaveBeenCalledWith(
      'run-1',
      TestRunFailureCategory.INTERNAL,
      'container crashed',
    );
  });

  it('ignores late worker failures after the run is already terminal', async () => {
    const state = {
      tryMarkInfraFailed: jest.fn(() => Promise.resolve(null)),
    };
    const processor = new TestRunWorkerProcessor(
      { execute: jest.fn() } as unknown as RunnerOrchestratorService,
      state as unknown as TestRunStateService,
    );

    await processor.onFailed(
      {
        id: 'test-run:run-1',
        data: { testRunId: 'run-1' },
        attemptsMade: 1,
        opts: { attempts: 1 },
      } as never,
      new Error('late worker failure'),
    );

    expect(state.tryMarkInfraFailed).toHaveBeenCalledWith(
      'run-1',
      TestRunFailureCategory.INTERNAL,
      'late worker failure',
    );
  });
});
