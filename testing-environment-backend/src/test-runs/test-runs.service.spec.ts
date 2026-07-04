import { TestRunStatus } from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunQueueService } from '../queue/test-run-queue.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
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
  };
  let queue: {
    getJobId: jest.Mock;
    enqueue: jest.Mock;
    cancelQueuedRun: jest.Mock;
  };
  let service: TestRunsService;

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
            status: TestRunStatus.PENDING,
            cancellationRequestedAt: null,
            finishedAt: null,
          }),
        ),
      },
    };
    queue = {
      getJobId: jest.fn((runId: string) => `test-run:${runId}`),
      enqueue: jest.fn(() => Promise.resolve('test-run:run-1')),
      cancelQueuedRun: jest.fn(() => Promise.resolve('removed')),
    };

    service = new TestRunsService(
      prisma as unknown as PrismaService,
      {
        getProjectOrThrow: jest.fn(() => Promise.resolve({ id: projectId })),
      } as unknown as ProjectAccessService,
      { assertCanStartRun: jest.fn(() => Promise.resolve()) } as unknown as SubscriptionsService,
      queue as unknown as TestRunQueueService,
    );
  });

  it('creates a run and enqueues a deterministic job', async () => {
    const run = await service.create(projectId, companyId);

    expect(run.status).toBe(TestRunStatus.PENDING);
    expect(prisma.testRun.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        projectId,
        status: TestRunStatus.PENDING,
        queueJobId: expect.stringMatching(/^test-run:/),
      },
    });
    expect(queue.enqueue).toHaveBeenCalledWith(run.id);
  });

  it('marks run as failed when enqueue fails', async () => {
    queue.enqueue.mockRejectedValueOnce(new Error('redis unavailable'));

    const run = await service.create(projectId, companyId);

    expect(run.status).toBe(TestRunStatus.FAILED);
    expect(prisma.testRun.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({
        status: TestRunStatus.FAILED,
        errorMessage: expect.stringContaining('redis unavailable'),
      }),
    });
  });

  it('cancels queued jobs through durable queue state', async () => {
    await service.cancel(projectId, 'run-1', companyId);

    expect(queue.cancelQueuedRun).toHaveBeenCalledWith('run-1');
    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TestRunStatus.PENDING },
      data: { cancellationRequestedAt: expect.any(Date) },
    });
    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TestRunStatus.PENDING },
      data: {
        status: TestRunStatus.CANCELLED,
        cancellationRequestedAt: expect.any(Date),
        finishedAt: expect.any(Date),
      },
    });
  });

  it('does not depend on in-memory runner cancellation for running jobs', async () => {
    prisma.testRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      projectId,
      status: TestRunStatus.RUNNING,
      cancellationRequestedAt: null,
      finishedAt: null,
    });

    await service.cancel(projectId, 'run-1', companyId);

    expect(queue.cancelQueuedRun).not.toHaveBeenCalled();
    expect(prisma.testRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TestRunStatus.RUNNING },
      data: {
        cancellationRequestedAt: expect.any(Date),
      },
    });
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
    expect(prisma.testRun.updateMany).not.toHaveBeenCalled();
  });
});
