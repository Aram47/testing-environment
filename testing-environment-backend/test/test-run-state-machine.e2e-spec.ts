import { Test } from '@nestjs/testing';
import { TestResultStatus, TestRunFailureCategory, TestRunStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { ArtifactLogWriterService } from '../src/artifacts/artifact-log-writer.service';
import { ArtifactsService } from '../src/artifacts/artifacts.service';
import { ReportArtifactService } from '../src/artifacts/report-artifact.service';
import { AssertionEngineService } from '../src/runner/assertion-engine.service';
import { DockerComposeManagerService } from '../src/runner/docker-compose-manager.service';
import { HealthcheckService } from '../src/runner/healthcheck.service';
import { HttpTestExecutorService } from '../src/runner/http-test-executor.service';
import { RunnerOrchestratorService } from '../src/runner/runner-orchestrator.service';
import { VariableStoreService } from '../src/runner/variable-store.service';
import { YamlTestParserService } from '../src/runner/yaml-test-parser.service';
import { SecretMaskingService } from '../src/secrets/secret-masking.service';
import { SecretReferenceResolverService } from '../src/secrets/secret-reference-resolver.service';
import { ExecutionPlanCompilerService } from '../src/test-suites/execution-plan-compiler.service';
import { ExecutionPlan, ExecutionStep } from '../src/test-suites/types/execution-plan.types';
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

  it('cancels during wait steps', async () => {
    const fixture = await createFixture({
      tests: [{ id: 'wait-1', name: 'Wait', wait: { duration_ms: 300 } }],
    });
    setTimeout(() => {
      fixture.run.cancellationRequestedAt = new Date();
    }, 10);

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.CANCELLED);
    expect(fixture.prisma.testResult.create).not.toHaveBeenCalled();
  });

  it('cancels during poll steps', async () => {
    const fixture = await createFixture({
      requestCancellationDuringHttp: true,
      tests: [
        {
          id: 'poll-1',
          name: 'Poll',
          poll: {
            timeout_seconds: 1,
            interval_seconds: 1,
            request: { method: 'GET', path: '/ready', expect: { status: 200 } },
          },
        },
      ],
    });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.CANCELLED);
    expect(fixture.prisma.testResult.create).not.toHaveBeenCalled();
  });

  it('cancels during HTTP requests', async () => {
    const fixture = await createFixture({ requestCancellationDuringHttp: true });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.CANCELLED);
    expect(fixture.prisma.testResult.create).not.toHaveBeenCalled();
  });

  it('records cleanup failure while preserving cancelled result', async () => {
    const fixture = await createFixture({
      requestCancellationWhenParsing: true,
      dockerDownError: new Error('docker compose down failed'),
    });

    await fixture.orchestrator.execute('run-1');

    expect(fixture.run.status).toBe(TestRunStatus.CANCELLED);
    expect(fixture.run.cleanupError).toBe('docker compose down failed');
  });
});

interface FixtureOptions {
  dockerUpError?: Error;
  dockerDownError?: Error;
  healthcheckError?: Error;
  httpResult?: {
    actualStatus?: number;
    responseBody?: unknown;
    durationMs: number;
    errorMessage?: string;
  };
  tests?: Record<string, unknown>[];
  requestCancellationWhenParsing?: boolean;
  requestCancellationDuringHttp?: boolean;
  concurrentCancelOnClaim?: boolean;
}

async function createFixture(options: FixtureOptions = {}) {
  const statusHistory: TestRunStatus[] = [];
  const tests = options.tests ?? [
    {
      id: 'step-1',
      name: 'GET /health',
      request: { method: 'GET', path: '/health', expect: { status: 200 } },
    },
  ];
  const executionPlan = toExecutionPlan(tests);
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
    cleanupError: null as string | null,
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
    },
    environmentConfigRevision: {
      compiledComposeYaml: 'services:\n  app:\n    image: nginx\n',
      compiledRuntimeYaml: 'version: "1.0"\n',
    },
    suiteRevisions: [
      {
        testSuiteRevisionId: 'suite-revision-1',
        suiteName: 'Suite',
        testSuiteRevision: {
          compiledYaml: 'suite: Suite\n',
          executionPlan: options.requestCancellationWhenParsing ? null : executionPlan,
        },
      },
    ],
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
  if (options.dockerDownError) {
    docker.down.mockRejectedValue(options.dockerDownError);
  }
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
        tests,
      };
    }),
  };
  const executionPlanCompiler = {
    compileRawYaml: jest.fn(() => {
      if (options.requestCancellationWhenParsing) {
        run.cancellationRequestedAt = new Date();
      }
      return { executionPlan };
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
      { provide: ExecutionPlanCompilerService, useValue: executionPlanCompiler },
      {
        provide: HttpTestExecutorService,
        useValue: {
          execute: jest.fn(() => {
            if (options.requestCancellationDuringHttp) {
              run.cancellationRequestedAt = new Date();
            }
            return Promise.resolve(
              options.httpResult ?? {
                actualStatus: 200,
                responseBody: { ok: true },
                durationMs: 10,
              },
            );
          }),
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
      {
        provide: SecretReferenceResolverService,
        useValue: {
          resolveForRun: jest.fn(() =>
            Promise.resolve({ secrets: new Map(), masking: { values: [] } }),
          ),
          replaceReferences: jest.fn((value: unknown) => value),
        },
      },
      {
        provide: SecretMaskingService,
        useValue: {
          emptyContext: jest.fn(() => ({ values: [] })),
          maskString: jest.fn((value: string) => value),
          maskValue: jest.fn((value: unknown) => value),
        },
      },
      {
        provide: ArtifactsService,
        useValue: {
          putOrReplace: jest.fn(() => Promise.resolve({ id: 'response-artifact-1' })),
          previewLimitBytes: jest.fn(() => 16 * 1024),
          retentionUntil: jest.fn(() => new Date('2026-08-01T00:00:00.000Z')),
        },
      },
      { provide: ArtifactLogWriterService, useValue: { append: jest.fn() } },
      {
        provide: ReportArtifactService,
        useValue: { generateForRun: jest.fn(() => Promise.resolve()) },
      },
    ],
  }).compile();

  return {
    orchestrator: moduleRef.get(RunnerOrchestratorService),
    prisma,
    run,
    statusHistory,
  };
}

function toExecutionPlan(rawTests: Record<string, unknown>[]): ExecutionPlan {
  const steps = rawTests.map((test, index) => toExecutionStep(test, index));
  return {
    schemaVersion: 'execution-plan/v1',
    suiteRevisionId: 'suite-revision-1',
    suiteName: 'Suite',
    steps,
    dependencies: Object.fromEntries(
      steps.map((step, index) => [step.id, index === 0 ? [] : [steps[index - 1].id]]),
    ),
    variables: [],
    timeoutMs: 300000,
  };
}

function toExecutionStep(test: Record<string, unknown>, index: number): ExecutionStep {
  const id = String(test.id ?? `step-${index + 1}`);
  const name = String(test.name ?? id);
  if ('wait' in test) {
    const wait = test.wait as { duration_ms: number };
    return {
      id,
      type: 'wait',
      version: 'wait/v1',
      name,
      config: { durationMs: wait.duration_ms },
      timeoutMs: 60000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
      continueOnFailure: false,
    };
  }
  if ('poll' in test) {
    const poll = test.poll as {
      timeout_seconds: number;
      interval_seconds: number;
      request: { method: string; path: string; expect?: { status?: number } };
    };
    return {
      id,
      type: 'pollUntil',
      version: 'pollUntil/v1',
      name,
      config: {
        timeoutMs: poll.timeout_seconds * 1000,
        intervalMs: poll.interval_seconds * 1000,
        request: {
          method: poll.request.method,
          path: poll.request.path,
          expect: { status: poll.request.expect?.status ?? 200 },
        },
      },
      timeoutMs: poll.timeout_seconds * 1000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
      continueOnFailure: false,
    };
  }
  const request = test.request as {
    method: string;
    path: string;
    expect?: { status?: number };
  };
  return {
    id,
    type: 'apiRequest',
    version: 'apiRequest/v1',
    name,
    config: {
      method: request.method,
      path: request.path,
      expect: { status: request.expect?.status ?? 200 },
    },
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    continueOnFailure: false,
  };
}
