import { Test } from '@nestjs/testing';
import { TestResultStatus, TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { AssertionEngineService } from '../src/runner/assertion-engine.service';
import { DockerComposeManagerService } from '../src/runner/docker-compose-manager.service';
import { HealthcheckService } from '../src/runner/healthcheck.service';
import { HttpTestExecutorService } from '../src/runner/http-test-executor.service';
import { RunnerOrchestratorService } from '../src/runner/runner-orchestrator.service';
import { VariableStoreService } from '../src/runner/variable-store.service';
import { YamlTestParserService } from '../src/runner/yaml-test-parser.service';
import { TestRunStateService } from '../src/test-runs/test-run-state.service';
import { RealtimeService } from '../src/websocket/realtime.service';

describe('Durable TestRun state machine (e2e)', () => {
  it('marks a successful run as PASSED', async () => {
    const fixture = await createFixture();

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.PASSED);
    expect(fixture.run.failureCategory).toBeNull();
    expect(fixture.prisma.testResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: TestResultStatus.PASSED }),
    });
  });

  it('marks assertion failures as TEST_FAILED', async () => {
    const fixture = await createFixture({
      httpResult: { actualStatus: 500, responseBody: { error: 'bad' }, durationMs: 10 },
    });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.TEST_FAILED);
    expect(fixture.run.failureCategory).toBe(TestRunFailureCategory.TEST_ASSERTION);
  });

  it('marks healthcheck failures as INFRA_FAILED', async () => {
    const fixture = await createFixture({
      healthcheckError: new Error('Healthcheck expected 200, got 500'),
    });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.INFRA_FAILED);
    expect(fixture.run.failureCategory).toBe(TestRunFailureCategory.HEALTHCHECK);
  });

  it('marks Docker startup failures as INFRA_FAILED', async () => {
    const fixture = await createFixture({
      dockerUpError: new Error('container exited before becoming healthy'),
    });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.INFRA_FAILED);
    expect(fixture.run.failureCategory).toBe(TestRunFailureCategory.CONTAINER_START);
  });

  it('marks timeout failures as TIMED_OUT', async () => {
    const fixture = await createFixture({
      healthcheckError: new Error('Healthcheck timed out'),
    });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.TIMED_OUT);
    expect(fixture.run.failureCategory).toBe(TestRunFailureCategory.TIMEOUT);
  });

  it('marks cancellation as CANCELLED through CANCEL_REQUESTED', async () => {
    const fixture = await createFixture({ requestCancellationWhenParsing: true });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.statusHistory).toContain(TestRunStatus.CANCEL_REQUESTED);
    expect(fixture.run.status).toBe(TestRunStatus.CANCELLED);
    expect(fixture.run.failureCategory).toBe(TestRunFailureCategory.CANCELLED);
  });

  it('finalizes cancellation when cancel wins the race against worker claim', async () => {
    const fixture = await createFixture({ concurrentCancelOnClaim: true });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.statusHistory).toContain(TestRunStatus.CANCEL_REQUESTED);
    expect(fixture.run.status).toBe(TestRunStatus.CANCELLED);
    expect(fixture.run.failureCategory).toBe(TestRunFailureCategory.CANCELLED);
  });
});

interface FixtureOptions {
  dockerUpError?: Error;
  healthcheckError?: Error;
  httpResult?: {
    actualStatus?: number;
    responseBody?: unknown;
    durationMs: number;
    errorMessage?: string;
  };
  requestCancellationWhenParsing?: boolean;
  concurrentCancelOnClaim?: boolean;
}

async function createFixture(options: FixtureOptions = {}) {
  const statusHistory: TestRunStatus[] = [];
  const run = {
    id: 'run-1',
    projectId: 'project-1',
    status: TestRunStatus.QUEUED as TestRunStatus,
    statusReason: null as string | null,
    failureCategory: null as TestRunFailureCategory | null,
    currentPhase: null as string | null,
    phaseTimestamps: null as Record<string, string> | null,
    queueJobId: 'test-run:run-1',
    queuedAt: new Date(),
    enqueuedAt: new Date(),
    claimedAt: null as Date | null,
    cancellationRequestedAt: null as Date | null,
    startedAt: null as Date | null,
    finishedAt: null as Date | null,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    durationMs: null as number | null,
    errorMessage: null as string | null,
    project: {
      baseUrl: 'http://example.test',
      healthcheckPath: '/health',
      healthcheckExpectedStatus: 200,
      healthcheckTimeoutSeconds: 1,
      environmentConfig: {
        composeYaml: 'services:\n  app:\n    image: nginx\n',
        backendTestYaml: 'version: "1.0"\n',
      },
      testSuites: [{ id: 'suite-1', name: 'Suite', yamlContent: 'suite: Suite\n' }],
    },
  };

  const prisma = {
    testRun: {
      findUnique: jest.fn(() => Promise.resolve(run)),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(run)),
      updateMany: jest.fn(
        ({ data, where }: { data: Record<string, unknown>; where: { status?: TestRunStatus } }) => {
          if (
            options.concurrentCancelOnClaim &&
            where.status === TestRunStatus.QUEUED &&
            data.status === TestRunStatus.CLAIMED
          ) {
            run.status = TestRunStatus.CANCEL_REQUESTED;
            run.cancellationRequestedAt = new Date();
            statusHistory.push(run.status);
            return Promise.resolve({ count: 0 });
          }

          Object.assign(run, data);
          statusHistory.push(run.status);
          return Promise.resolve({ count: 1 });
        },
      ),
    },
    runnerLog: {
      create: jest.fn(() => Promise.resolve({ id: 'log-1' })),
    },
    testResult: {
      create: jest.fn(({ data }: { data: { status: TestResultStatus } }) => {
        return Promise.resolve({ id: 'result-1', ...data });
      }),
    },
  };

  const docker = {
    validateCompose: jest.fn(),
    up: jest.fn(() =>
      options.dockerUpError ? Promise.reject(options.dockerUpError) : Promise.resolve('started'),
    ),
    logs: jest.fn(() => Promise.resolve('docker logs')),
    down: jest.fn(() => Promise.resolve('stopped')),
  };
  const healthcheck = {
    waitFor: jest.fn(() =>
      options.healthcheckError ? Promise.reject(options.healthcheckError) : Promise.resolve(),
    ),
  };
  const parser = {
    parseSuite: jest.fn(() => {
      if (options.requestCancellationWhenParsing) {
        run.cancellationRequestedAt = new Date();
      }
      return {
        suite: 'Suite',
        tests: [
          {
            id: 'step-1',
            name: 'GET /health',
            request: { method: 'GET', path: '/health', expect: { status: 200 } },
          },
        ],
      };
    }),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      RunnerOrchestratorService,
      TestRunStateService,
      { provide: PrismaService, useValue: prisma },
      {
        provide: ConfigService,
        useValue: { get: jest.fn((_key: string, fallback: unknown) => fallback) },
      },
      { provide: DockerComposeManagerService, useValue: docker },
      { provide: HealthcheckService, useValue: healthcheck },
      { provide: YamlTestParserService, useValue: parser },
      {
        provide: HttpTestExecutorService,
        useValue: {
          execute: jest.fn(() =>
            Promise.resolve(
              options.httpResult ?? {
                actualStatus: 200,
                responseBody: { ok: true },
                durationMs: 10,
              },
            ),
          ),
        },
      },
      {
        provide: AssertionEngineService,
        useValue: {
          contains: jest.fn(() => true),
          evaluateAssertions: jest.fn(() => ({ passed: true })),
          readJsonPath: jest.fn(),
        },
      },
      {
        provide: VariableStoreService,
        useValue: {
          create: jest.fn(() => new Map()),
          interpolate: jest.fn((value: unknown) => value),
        },
      },
      { provide: RealtimeService, useValue: { emitRunEvent: jest.fn() } },
    ],
  }).compile();

  return {
    orchestrator: moduleRef.get(RunnerOrchestratorService),
    prisma,
    run,
    statusHistory,
  };
}
