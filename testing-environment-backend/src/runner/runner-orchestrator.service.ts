import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RunnerLogSource,
  TestResultStatus,
  TestRunFailureCategory,
  TestRunStatus,
} from '@prisma/client';
import { mkdir, rm, writeFile } from 'fs/promises';
import { hostname } from 'os';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { RealtimeService } from '../websocket/realtime.service';
import { AssertionEngineService } from './assertion-engine.service';
import { DockerComposeManagerService } from './docker-compose-manager.service';
import { HealthcheckService } from './healthcheck.service';
import { HttpTestExecutorService } from './http-test-executor.service';
import {
  HttpExecutionResult,
  YamlPollStep,
  YamlRequest,
  YamlTestCase,
  YamlWaitStep,
} from './types/yaml-test.types';
import { VariableStoreService } from './variable-store.service';
import { YamlTestParserService } from './yaml-test-parser.service';

interface StepExecutionResult extends HttpExecutionResult {
  status: TestResultStatus;
  errorMessage?: string;
  attempts: number;
  durationMs: number;
}

interface RunExecutionContext {
  signal: AbortSignal;
  stop: () => void;
}

class TestRunCancellationError extends Error {
  constructor() {
    super('Test run was cancelled');
  }
}

class TestRunTimeoutError extends Error {
  constructor(message: string) {
    super(message);
  }
}

@Injectable()
export class RunnerOrchestratorService {
  private readonly logger = new Logger(RunnerOrchestratorService.name);
  private readonly runnerId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly docker: DockerComposeManagerService,
    private readonly healthcheck: HealthcheckService,
    private readonly parser: YamlTestParserService,
    private readonly http: HttpTestExecutorService,
    private readonly assertions: AssertionEngineService,
    private readonly variables: VariableStoreService,
    private readonly realtime: RealtimeService,
    private readonly state: TestRunStateService,
  ) {
    this.runnerId =
      this.config.get<string>('TEST_RUN_RUNNER_ID') ?? `${hostname()}-${process.pid}`;
  }

  async execute(testRunId: string): Promise<void> {
    const started = Date.now();
    let workspace = '';
    let context: RunExecutionContext | undefined;
    try {
      const run = await this.prisma.testRun.findUnique({
        where: { id: testRunId },
        include: { project: { include: { environmentConfig: true, testSuites: true } } },
      });
      if (!run) {
        throw new NotFoundException('Test run not found');
      }
      if (await this.isCancellationRequested(testRunId)) {
        await this.state.markCancelled(testRunId, Date.now() - started);
        return;
      }
      if (run.status !== TestRunStatus.QUEUED) {
        this.logger.warn(`Skipping test run ${testRunId} because it is ${run.status}`);
        return;
      }
      if (!run.project.environmentConfig) {
        throw new Error('Environment config is required before running tests');
      }
      if (run.project.testSuites.length === 0) {
        throw new Error('At least one test suite is required');
      }

      await this.state.claim(testRunId, {
        runnerId: this.runnerId,
        leaseDurationMs: this.leaseDurationMs(),
      });
      context = this.createExecutionContext(testRunId);
      await this.ensureNotCancelled(testRunId, context);

      await this.state.enterPhase(testRunId, TestRunStatus.PREPARING_WORKSPACE);
      workspace = await this.createWorkspace(testRunId);
      await this.log(testRunId, RunnerLogSource.SYSTEM, 'Preparing isolated local workspace');
      this.emit('run.started', testRunId);

      const { environmentConfig, testSuites } = run.project;
      await this.state.enterPhase(testRunId, TestRunStatus.VALIDATING_ENVIRONMENT);
      this.docker.validateCompose(environmentConfig.composeYaml);
      await writeFile(join(workspace, 'docker-compose.test.yml'), environmentConfig.composeYaml);
      await writeFile(join(workspace, 'backend-test.yml'), environmentConfig.backendTestYaml);
      await mkdir(join(workspace, 'tests'), { recursive: true });
      for (const suite of testSuites) {
        await writeFile(join(workspace, 'tests', `${suite.id}.yml`), suite.yamlContent);
      }

      await this.ensureNotCancelled(testRunId, context);
      await this.state.enterPhase(testRunId, TestRunStatus.PULLING_IMAGES);
      await this.log(testRunId, RunnerLogSource.SYSTEM, 'Preparing docker images');
      await this.state.enterPhase(testRunId, TestRunStatus.STARTING_ENVIRONMENT);
      this.emit('environment.starting', testRunId);
      await this.log(testRunId, RunnerLogSource.SYSTEM, 'Starting docker compose environment');
      await this.docker.up(workspace, context.signal);

      await this.ensureNotCancelled(testRunId, context);
      await this.state.enterPhase(testRunId, TestRunStatus.WAITING_FOR_HEALTHCHECK);
      await this.healthcheck.waitFor(
        run.project.baseUrl,
        run.project.healthcheckPath,
        run.project.healthcheckExpectedStatus,
        run.project.healthcheckTimeoutSeconds,
        context.signal,
      );
      this.emit('environment.ready', testRunId);

      await this.state.enterPhase(testRunId, TestRunStatus.EXECUTING_TESTS);
      const stats = await this.executeSuites(testRunId, run.project.baseUrl, testSuites, context);
      await this.state.enterPhase(testRunId, TestRunStatus.COLLECTING_ARTIFACTS);
      const dockerLogs = await this.safeDockerLogs(workspace);
      if (dockerLogs) {
        await this.log(testRunId, RunnerLogSource.DOCKER, dockerLogs.slice(-20000));
        this.emit('logs.updated', testRunId);
      }

      await this.state.enterPhase(testRunId, TestRunStatus.CLEANING_UP);
      if (workspace) {
        await this.cleanupWorkspace(testRunId, workspace);
        workspace = '';
      }

      if (await this.isCancellationRequested(testRunId)) {
        await this.state.markCancelled(testRunId, Date.now() - started);
      } else if (stats.failedTests > 0) {
        await this.state.markTestFailed(
          testRunId,
          stats,
          Date.now() - started,
          `${stats.failedTests} test assertion(s) failed`,
        );
      } else {
        await this.state.markPassed(testRunId, stats, Date.now() - started);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Runner failed';
      await this.log(testRunId, RunnerLogSource.ERROR, message).catch(() => undefined);
      if (
        error instanceof TestRunCancellationError ||
        (await this.isCancellationRequested(testRunId))
      ) {
        if (!(await this.state.isCancellationRequested(testRunId))) {
          await this.state.requestCancel(testRunId).catch(() => undefined);
        }
        const cleanupError = workspace
          ? await this.cleanupWorkspace(testRunId, workspace).catch((cleanupFailure) =>
              String(cleanupFailure),
            )
          : undefined;
        workspace = '';
        await this.state
          .markCancelled(testRunId, Date.now() - started, cleanupError)
          .catch(() => undefined);
      } else if (error instanceof TestRunTimeoutError) {
        await this.state
          .markTimedOut(testRunId, message, Date.now() - started)
          .catch(() => undefined);
      } else {
        const failureCategory = await this.failureCategoryFor(testRunId, message);
        if (failureCategory === TestRunFailureCategory.TIMEOUT) {
          await this.state
            .markTimedOut(testRunId, message, Date.now() - started)
            .catch(() => undefined);
        } else {
          await this.state
            .markInfraFailed(testRunId, failureCategory, message, Date.now() - started)
            .catch(() => undefined);
        }
      }
    } finally {
      context?.stop();
      if (workspace) {
        this.emit('environment.stopping', testRunId);
        await this.docker
          .down(workspace)
          .catch((error) => this.log(testRunId, RunnerLogSource.ERROR, String(error)));
        await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
      }
      this.emit('run.finished', testRunId);
    }
  }

  private async executeSuites(
    testRunId: string,
    baseUrl: string,
    suites: { name: string; yamlContent: string }[],
    context: RunExecutionContext,
  ): Promise<{ totalTests: number; passedTests: number; failedTests: number }> {
    const store = this.variables.create();
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const suiteRecord of suites) {
      const suite = this.parser.parseSuite(suiteRecord.yamlContent);
      for (const test of suite.tests) {
        await this.ensureNotCancelled(testRunId, context);
        totalTests += 1;
        const stepMeta = this.getStepMeta(test);
        this.emit('test.started', testRunId, {
          suiteName: suite.suite,
          testName: test.name,
          ...stepMeta,
        });
        const result = await this.executeStep(testRunId, baseUrl, test, store, context);
        const passed = result.status === TestResultStatus.PASSED;
        passedTests += passed ? 1 : 0;
        failedTests += passed ? 0 : 1;
        await this.prisma.testResult.create({
          data: {
            testRunId,
            stepId: stepMeta.stepId,
            stepType: stepMeta.stepType,
            suiteName: suite.suite,
            testName: test.name,
            status: result.status,
            method: stepMeta.method,
            path: stepMeta.path,
            expectedStatus: stepMeta.expectedStatus,
            actualStatus: result.actualStatus,
            attempts: result.attempts,
            durationMs: result.durationMs,
            requestBody: this.toJsonValue(stepMeta.requestBody),
            responseBody: this.toJsonValue(result.responseBody),
            errorMessage: result.errorMessage,
          },
        });
        this.emit(passed ? 'test.passed' : 'test.failed', testRunId, {
          suiteName: suite.suite,
          testName: test.name,
          ...stepMeta,
          attempts: result.attempts,
          errorMessage: result.errorMessage,
        });
      }
    }
    return { totalTests, passedTests, failedTests };
  }

  private async executeStep(
    testRunId: string,
    baseUrl: string,
    test: YamlTestCase,
    store: Map<string, string>,
    context: RunExecutionContext,
  ): Promise<StepExecutionResult> {
    if (this.isWaitStep(test)) {
      return this.executeWait(testRunId, test, context);
    }

    if (this.isPollStep(test)) {
      return this.executePoll(testRunId, baseUrl, test, store, context);
    }

    return this.executeRequest(testRunId, baseUrl, test.name, test.request, store, context);
  }

  private async executeRequest(
    testRunId: string,
    baseUrl: string,
    name: string,
    requestDefinition: YamlRequest,
    store: Map<string, string>,
    context: RunExecutionContext,
  ): Promise<StepExecutionResult> {
    const request = this.variables.interpolate(requestDefinition, store);
    const result = await this.http.execute(baseUrl, { name, request }, store, context.signal);
    await this.ensureNotCancelled(testRunId, context);
    return this.evaluateRequestResult(result, request, store, 1);
  }

  private async executePoll(
    testRunId: string,
    baseUrl: string,
    test: YamlPollStep,
    store: Map<string, string>,
    context: RunExecutionContext,
  ): Promise<StepExecutionResult> {
    const started = Date.now();
    const timeoutMs = test.poll.timeout_seconds * 1000;
    const intervalMs = test.poll.interval_seconds * 1000;
    let attempts = 0;
    let lastResult: StepExecutionResult | undefined;

    while (Date.now() - started <= timeoutMs) {
      await this.ensureNotCancelled(testRunId, context);
      attempts += 1;
      const request = this.variables.interpolate(test.poll.request, store);
      const httpResult = await this.http.execute(
        baseUrl,
        { name: test.name, request },
        store,
        context.signal,
      );
      await this.ensureNotCancelled(testRunId, context);
      lastResult = this.evaluateRequestResult(httpResult, request, store, attempts);
      if (lastResult.status === TestResultStatus.PASSED) {
        return { ...lastResult, durationMs: Date.now() - started, attempts };
      }
      await this.sleep(
        Math.min(intervalMs, Math.max(timeoutMs - (Date.now() - started), 0)),
        testRunId,
        context,
      );
    }

    return {
      ...(lastResult ?? { durationMs: Date.now() - started }),
      status: TestResultStatus.FAILED,
      attempts,
      durationMs: Date.now() - started,
      errorMessage:
        test.poll.failure_message ?? `Poll timed out after ${test.poll.timeout_seconds} seconds`,
    };
  }

  private async executeWait(
    testRunId: string,
    test: YamlWaitStep,
    context: RunExecutionContext,
  ): Promise<StepExecutionResult> {
    const started = Date.now();
    await this.sleep(test.wait.duration_ms, testRunId, context);
    return {
      status: TestResultStatus.PASSED,
      durationMs: Date.now() - started,
      attempts: 1,
      responseBody: { waitedMs: test.wait.duration_ms },
    };
  }

  private evaluateRequestResult(
    result: HttpExecutionResult,
    request: YamlRequest,
    store: Map<string, string>,
    attempts: number,
  ): StepExecutionResult {
    const expectedStatus = request.expect?.status ?? 200;
    const statusMatches = result.actualStatus === expectedStatus;
    const bodyMatches = this.assertions.contains(
      result.responseBody,
      request.expect?.json_contains,
    );
    const assertionResult = this.assertions.evaluateAssertions(
      result.responseBody,
      request.expect?.assertions,
    );
    const passed = !result.errorMessage && statusMatches && bodyMatches && assertionResult.passed;
    if (passed && request.save) {
      for (const [key, path] of Object.entries(request.save)) {
        const value = this.assertions.readJsonPath(result.responseBody, path);
        if (value !== undefined) {
          store.set(key, value);
        }
      }
    }
    return {
      ...result,
      status: passed ? TestResultStatus.PASSED : TestResultStatus.FAILED,
      attempts,
      errorMessage:
        result.errorMessage ??
        (!statusMatches
          ? `Expected status ${expectedStatus}, got ${result.actualStatus}`
          : undefined) ??
        (!bodyMatches ? 'Response body does not contain expected JSON' : undefined) ??
        assertionResult.message,
    };
  }

  private getStepMeta(test: YamlTestCase) {
    if (this.isWaitStep(test)) {
      return {
        stepId: test.id,
        stepType: 'wait',
        method: 'WAIT',
        path: 'delay',
        expectedStatus: 0,
        requestBody: { durationMs: test.wait.duration_ms },
      };
    }

    if (this.isPollStep(test)) {
      return {
        stepId: test.id,
        stepType: 'pollUntil',
        method: test.poll.request.method.toUpperCase(),
        path: test.poll.request.path,
        expectedStatus: test.poll.request.expect?.status ?? 200,
        requestBody: test.poll.request.json,
      };
    }

    return {
      stepId: test.id,
      stepType: 'apiRequest',
      method: test.request.method.toUpperCase(),
      path: test.request.path,
      expectedStatus: test.request.expect?.status ?? 200,
      requestBody: test.request.json,
    };
  }

  private isWaitStep(test: YamlTestCase): test is YamlWaitStep {
    return 'wait' in test;
  }

  private isPollStep(test: YamlTestCase): test is YamlPollStep {
    return 'poll' in test;
  }

  private async sleep(
    durationMs: number,
    testRunId: string,
    context: RunExecutionContext,
  ): Promise<void> {
    const deadline = Date.now() + durationMs;
    while (Date.now() < deadline) {
      await this.ensureNotCancelled(testRunId, context);
      await new Promise((resolve) => setTimeout(resolve, Math.min(250, deadline - Date.now())));
    }
  }

  private async createWorkspace(testRunId: string): Promise<string> {
    const root = this.config.get<string>('RUNNER_WORKSPACE_ROOT', '/tmp/backend-test-runner');
    const workspace = join(root, testRunId);
    await mkdir(workspace, { recursive: true });
    return workspace;
  }

  private async log(testRunId: string, source: RunnerLogSource, message: string): Promise<void> {
    await this.prisma.runnerLog.create({ data: { testRunId, source, message } });
  }

  private async safeDockerLogs(workspace: string): Promise<string> {
    try {
      return await this.docker.logs(workspace);
    } catch (error) {
      return error instanceof Error ? error.message : '';
    }
  }

  private async ensureNotCancelled(
    testRunId: string,
    context?: RunExecutionContext,
  ): Promise<void> {
    if (context?.signal.aborted) {
      throw context.signal.reason instanceof Error
        ? context.signal.reason
        : new TestRunCancellationError();
    }
    if (await this.isCancellationRequested(testRunId)) {
      throw new TestRunCancellationError();
    }
  }

  private async isCancellationRequested(testRunId: string): Promise<boolean> {
    return this.state.isCancellationRequested(testRunId);
  }

  private createExecutionContext(testRunId: string): RunExecutionContext {
    const controller = new AbortController();
    const timers: NodeJS.Timeout[] = [];
    let stopped = false;

    const abortIfCancellationRequested = async () => {
      if (stopped || controller.signal.aborted) {
        return;
      }
      if (await this.state.isCancellationRequested(testRunId)) {
        controller.abort(new TestRunCancellationError());
      }
    };

    const renewLease = async () => {
      if (stopped || controller.signal.aborted) {
        return;
      }
      const renewed = await this.state.renewLease(
        testRunId,
        this.runnerId,
        this.leaseDurationMs(),
      );
      if (!renewed) {
        controller.abort(new Error('Test run execution lease was lost'));
      }
    };

    timers.push(setInterval(() => void abortIfCancellationRequested(), this.cancelPollMs()));
    timers.push(setInterval(() => void renewLease(), this.heartbeatIntervalMs()));
    void abortIfCancellationRequested();
    void renewLease();

    return {
      signal: controller.signal,
      stop: () => {
        stopped = true;
        timers.forEach((timer) => clearInterval(timer));
      },
    };
  }

  private async cleanupWorkspace(
    testRunId: string,
    workspace: string,
  ): Promise<string | undefined> {
    this.emit('environment.stopping', testRunId);
    let cleanupError: string | undefined;
    await this.docker.down(workspace).catch(async (error) => {
      cleanupError = error instanceof Error ? error.message : String(error);
      await this.log(testRunId, RunnerLogSource.ERROR, cleanupError).catch(() => undefined);
    });
    await rm(workspace, { recursive: true, force: true }).catch((error) => {
      cleanupError = error instanceof Error ? error.message : String(error);
    });
    return cleanupError;
  }

  private leaseDurationMs(): number {
    return this.config.get<number>('TEST_RUN_LEASE_DURATION_MS', 60000);
  }

  private heartbeatIntervalMs(): number {
    return this.config.get<number>('TEST_RUN_HEARTBEAT_INTERVAL_MS', 15000);
  }

  private cancelPollMs(): number {
    return this.config.get<number>('TEST_RUN_CANCELLATION_POLL_INTERVAL_MS', 1000);
  }

  private async failureCategoryFor(
    testRunId: string,
    message: string,
  ): Promise<TestRunFailureCategory> {
    const run = await this.prisma.testRun.findUnique({
      where: { id: testRunId },
      select: { status: true },
    });
    if (run?.status === TestRunStatus.VALIDATING_ENVIRONMENT) {
      return TestRunFailureCategory.ENVIRONMENT_VALIDATION;
    }
    if (run?.status === TestRunStatus.PULLING_IMAGES || /pull|image/i.test(message)) {
      return TestRunFailureCategory.IMAGE_PULL;
    }
    if (run?.status === TestRunStatus.STARTING_ENVIRONMENT) {
      return TestRunFailureCategory.CONTAINER_START;
    }
    if (run?.status === TestRunStatus.WAITING_FOR_HEALTHCHECK) {
      return /timeout|timed out/i.test(message)
        ? TestRunFailureCategory.TIMEOUT
        : TestRunFailureCategory.HEALTHCHECK;
    }
    if (/network|ECONN|ENOTFOUND|EAI_AGAIN/i.test(message)) {
      return TestRunFailureCategory.NETWORK;
    }
    return TestRunFailureCategory.INTERNAL;
  }

  private emit(type: string, testRunId: string, payload?: Record<string, unknown>): void {
    this.realtime.emitRunEvent({ type, testRunId, payload });
  }

  private toJsonValue(value: unknown) {
    return value === undefined ? undefined : (value as object);
  }
}
