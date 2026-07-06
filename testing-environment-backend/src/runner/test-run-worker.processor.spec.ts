import { TestRunFailureCategory } from '@prisma/client';
import { ExecutionContextService } from '../observability/execution-context.service';
import { MetricsService } from '../observability/metrics.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { TracingService } from '../observability/tracing.service';
import { PrismaService } from '../prisma/prisma.service';
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
    const processor = createProcessor(orchestrator);

    await processor.process({ name: 'execute-test-run', data: { testRunId: 'run-1' } } as never);

    expect(orchestrator.execute).toHaveBeenCalledWith('run-1');
  });

  it('marks a run failed when the final worker attempt fails', async () => {
    const state = {
      tryMarkInfraFailed: jest.fn(() => Promise.resolve({ id: 'run-1' })),
    };
    const processor = createProcessor({ execute: jest.fn() }, state);

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
    const processor = createProcessor({ execute: jest.fn() }, state);

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

function createProcessor(
  orchestrator: unknown,
  state: unknown = { tryMarkInfraFailed: jest.fn() },
): TestRunWorkerProcessor {
  return new TestRunWorkerProcessor(
    orchestrator as unknown as RunnerOrchestratorService,
    { execute: jest.fn() } as unknown as import('../environment-configs/environment-dry-run-orchestrator.service').EnvironmentDryRunOrchestratorService,
    state as unknown as TestRunStateService,
    { markInfraFailed: jest.fn() } as unknown as import('../environment-configs/environment-dry-run-state.service').EnvironmentDryRunStateService,
    {
      testRun: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: 'run-1',
            projectId: 'project-1',
            runnerId: 'runner-1',
            project: { companyId: 'company-1' },
          }),
        ),
      },
    } as unknown as PrismaService,
    {
      run: jest.fn((_context: unknown, callback: () => Promise<unknown>) => callback()),
    } as unknown as ExecutionContextService,
    {
      setRunnerSlots: jest.fn(),
    } as unknown as MetricsService,
    {
      event: jest.fn(),
      eventError: jest.fn(),
    } as unknown as StructuredLoggerService,
    {
      span: jest.fn((_name: string, _attrs: unknown, callback: () => Promise<unknown>) =>
        callback(),
      ),
    } as unknown as TracingService,
  );
}
