import { RevisionStatus, TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ExecutionContextService } from '../observability/execution-context.service';
import { TracingService } from '../observability/tracing.service';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunQueueService } from '../queue/test-run-queue.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TestRunStateService } from './test-run-state.service';
import { TestRunsService } from './test-runs.service';

describe('TestRunsService', () => {
  const projectId = 'project-1';
  const companyId = 'company-1';
  let prisma: {
    testRun: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findFirst: jest.Mock;
    };
    environmentConfig: {
      findUnique: jest.Mock;
    };
    testSuite: {
      findMany: jest.Mock;
    };
    testRunEvent: {
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let queue: {
    getJobId: jest.Mock;
    enqueue: jest.Mock;
    cancelQueuedRun: jest.Mock;
  };
  let state: {
    isTerminal: jest.Mock;
    cancellableStatuses: TestRunStatus[];
    markInfraFailed: jest.Mock;
    requestCancel: jest.Mock;
    markCancelled: jest.Mock;
  };
  let service: TestRunsService;
  const terminalStatuses: TestRunStatus[] = [
    TestRunStatus.PASSED,
    TestRunStatus.TEST_FAILED,
    TestRunStatus.INFRA_FAILED,
    TestRunStatus.TIMED_OUT,
    TestRunStatus.CANCELLED,
  ];

  beforeEach(() => {
    prisma = {
      testRun: {
        create: jest.fn(
          ({
            data,
          }: {
            data: { id: string; projectId: string; status: TestRunStatus; queueJobId: string };
          }) => Promise.resolve(data),
        ),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'run-1', ...data }),
        ),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'run-1',
            projectId,
            status: TestRunStatus.QUEUED,
            cancellationRequestedAt: null,
            finishedAt: null,
          }),
        ),
      },
      environmentConfig: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: 'environment-1',
            revisions: [{ id: 'environment-revision-1', status: RevisionStatus.PUBLISHED }],
          }),
        ),
      },
      testSuite: {
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              id: 'suite-1',
              name: 'Suite',
              revisions: [{ id: 'suite-revision-1', status: RevisionStatus.PUBLISHED }],
            },
          ]),
        ),
      },
      testRunEvent: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    };
    queue = {
      getJobId: jest.fn((runId: string) => `test-run:${runId}`),
      enqueue: jest.fn(() => Promise.resolve('test-run:run-1')),
      cancelQueuedRun: jest.fn(() => Promise.resolve('removed')),
    };
    state = {
      isTerminal: jest.fn((status: TestRunStatus) => terminalStatuses.includes(status)),
      cancellableStatuses: [
        TestRunStatus.QUEUED,
        TestRunStatus.CLAIMED,
        TestRunStatus.PREPARING_WORKSPACE,
        TestRunStatus.VALIDATING_ENVIRONMENT,
        TestRunStatus.PULLING_IMAGES,
        TestRunStatus.STARTING_ENVIRONMENT,
        TestRunStatus.WAITING_FOR_HEALTHCHECK,
        TestRunStatus.EXECUTING_TESTS,
        TestRunStatus.COLLECTING_ARTIFACTS,
        TestRunStatus.CLEANING_UP,
      ],
      markInfraFailed: jest.fn(
        (_runId: string, _category: TestRunFailureCategory, reason: string) =>
          Promise.resolve({
            id: 'run-1',
            status: TestRunStatus.INFRA_FAILED,
            statusReason: reason,
          }),
      ),
      requestCancel: jest.fn(() =>
        Promise.resolve({ id: 'run-1', status: TestRunStatus.CANCEL_REQUESTED }),
      ),
      markCancelled: jest.fn(() =>
        Promise.resolve({ id: 'run-1', status: TestRunStatus.CANCELLED }),
      ),
    };

    service = new TestRunsService(
      prisma as unknown as PrismaService,
      {
        getProjectOrThrow: jest.fn(() => Promise.resolve({ id: projectId })),
      } as unknown as ProjectAccessService,
      { assertCanStartRun: jest.fn(() => Promise.resolve()) } as unknown as SubscriptionsService,
      queue as unknown as TestRunQueueService,
      state as unknown as TestRunStateService,
      { merge: jest.fn() } as unknown as ExecutionContextService,
      {
        span: jest.fn((_name: string, _attrs: unknown, callback: () => Promise<unknown>) =>
          callback(),
        ),
      } as unknown as TracingService,
    );
  });

  it('creates a run and enqueues a deterministic job', async () => {
    const run = await service.create(projectId, companyId);

    expect(run.status).toBe(TestRunStatus.QUEUED);
    expect(prisma.testRun.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        projectId,
        status: TestRunStatus.CREATED,
        queueJobId: expect.stringMatching(/^test-run:/),
        environmentConfigRevisionId: 'environment-revision-1',
        runnerVersion: 'local',
        reportSchemaVersion: 2,
        suiteRevisions: {
          create: [
            {
              testSuiteId: 'suite-1',
              testSuiteRevisionId: 'suite-revision-1',
              position: 0,
              suiteName: 'Suite',
            },
          ],
        },
      },
    });
    expect(queue.enqueue).toHaveBeenCalledWith(expect.any(String));
  });

  it('marks run as failed when enqueue fails', async () => {
    queue.enqueue.mockRejectedValueOnce(new Error('redis unavailable'));

    const run = await service.create(projectId, companyId);

    expect(run.status).toBe(TestRunStatus.INFRA_FAILED);
    expect(state.markInfraFailed).toHaveBeenCalledWith(
      expect.any(String),
      TestRunFailureCategory.INTERNAL,
      expect.stringContaining('redis unavailable'),
    );
  });

  it('cancels queued jobs through durable queue state', async () => {
    await service.cancel(projectId, 'run-1', companyId, 'user-1', 'no longer needed');

    expect(queue.cancelQueuedRun).toHaveBeenCalledWith('run-1');
    expect(state.requestCancel).toHaveBeenCalledWith('run-1', 'user-1', 'no longer needed');
    expect(state.markCancelled).toHaveBeenCalledWith('run-1');
  });

  it('does not depend on in-memory runner cancellation for running jobs', async () => {
    prisma.testRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      projectId,
      status: TestRunStatus.EXECUTING_TESTS,
      cancellationRequestedAt: null,
      finishedAt: null,
    });

    await service.cancel(projectId, 'run-1', companyId);

    expect(queue.cancelQueuedRun).not.toHaveBeenCalled();
    expect(state.requestCancel).toHaveBeenCalledWith('run-1', undefined, undefined);
  });

  it('does not rewrite terminal runs on cancel', async () => {
    prisma.testRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      projectId,
      status: TestRunStatus.PASSED,
      cancellationRequestedAt: null,
      finishedAt: new Date(),
    });

    const run = await service.cancel(projectId, 'run-1', companyId);

    expect(run.status).toBe(TestRunStatus.PASSED);
    expect(queue.cancelQueuedRun).not.toHaveBeenCalled();
    expect(state.requestCancel).not.toHaveBeenCalled();
  });

  it('returns events after the requested sequence in ascending order', async () => {
    prisma.testRun.findFirst.mockResolvedValueOnce({ id: 'run-1' });
    prisma.testRunEvent.findMany.mockResolvedValueOnce([
      {
        runId: 'run-1',
        sequence: 138,
        type: 'test.passed',
        timestamp: new Date('2026-07-06T10:00:00.000Z'),
        payload: { testName: 'healthcheck' },
      },
      {
        runId: 'run-1',
        sequence: 139,
        type: 'run.finished',
        timestamp: new Date('2026-07-06T10:00:01.000Z'),
        payload: {},
      },
    ]);

    const events = await service.events(projectId, 'run-1', companyId, 137);

    expect(prisma.testRunEvent.findMany).toHaveBeenCalledWith({
      where: { runId: 'run-1', sequence: { gt: 137 } },
      orderBy: { sequence: 'asc' },
      take: 500,
    });
    expect(events).toEqual([
      {
        runId: 'run-1',
        sequence: 138,
        type: 'test.passed',
        timestamp: '2026-07-06T10:00:00.000Z',
        payload: { testName: 'healthcheck' },
      },
      {
        runId: 'run-1',
        sequence: 139,
        type: 'run.finished',
        timestamp: '2026-07-06T10:00:01.000Z',
        payload: {},
      },
    ]);
  });

  it('throws when requesting events for a missing run', async () => {
    prisma.testRun.findFirst.mockResolvedValueOnce(null);

    await expect(service.events(projectId, 'missing-run', companyId, 0)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
