import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ArtifactCompression,
  ArtifactType,
  RunnerLogSource,
  TestResultStatus,
  TestRunFailureCategory,
  TestRunStatus,
} from '@prisma/client';
import { mkdir, rm, writeFile } from 'fs/promises';
import { hostname } from 'os';
import { join } from 'path';
import { ArtifactLogWriterService } from '../artifacts/artifact-log-writer.service';
import { previewJson, sanitizeArtifactKeySegment, toJsonBuffer } from '../artifacts/artifact-utils';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { ReportArtifactService } from '../artifacts/report-artifact.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecretExecutionContext,
  SecretReferenceResolverService,
} from '../secrets/secret-reference-resolver.service';
import { SecretMaskingService } from '../secrets/secret-masking.service';
import { ExecutionPlanCompilerService } from '../test-suites/execution-plan-compiler.service';
import {
  ApiRequestStepConfig,
  AssertExecutionStep,
  ExecutionPlan,
  ExecutionStep,
  PollUntilExecutionStep,
  WaitExecutionStep,
} from '../test-suites/types/execution-plan.types';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { RealtimeService } from '../websocket/realtime.service';
import { AssertionEngineService } from './assertion-engine.service';
import { DockerComposeManagerService } from './docker-compose-manager.service';
import { HealthcheckService } from './healthcheck.service';
import { HttpTestExecutorService } from './http-test-executor.service';
import { HttpExecutionResult } from './types/yaml-test.types';
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
    private readonly executionPlanCompiler: ExecutionPlanCompilerService,
    private readonly http: HttpTestExecutorService,
    private readonly assertions: AssertionEngineService,
    private readonly variables: VariableStoreService,
    private readonly realtime: RealtimeService,
    private readonly state: TestRunStateService,
    private readonly secrets: SecretReferenceResolverService,
    private readonly masking: SecretMaskingService,
    private readonly artifacts: ArtifactsService,
    private readonly logs: ArtifactLogWriterService,
    private readonly reports: ReportArtifactService,
  ) {
    this.runnerId = this.config.get<string>('TEST_RUN_RUNNER_ID') ?? `${hostname()}-${process.pid}`;
  }

  async execute(testRunId: string): Promise<void> {
    const started = Date.now();
    let workspace = '';
    let context: RunExecutionContext | undefined;
    let secretContext: SecretExecutionContext = {
      secrets: new Map(),
      masking: this.masking.emptyContext(),
    };
    try {
      const run = await this.prisma.testRun.findUnique({
        where: { id: testRunId },
        include: {
          project: true,
          environmentConfigRevision: true,
          suiteRevisions: {
            orderBy: { position: 'asc' },
            include: { testSuiteRevision: true },
          },
        },
      });
      if (!run) {
        throw new NotFoundException('Test run not found');
      }
      if (await this.isCancellationRequested(testRunId)) {
        await this.state.requestCancel(testRunId).catch(() => undefined);
        await this.state.markCancelled(testRunId, Date.now() - started);
        await this.generateReport(testRunId);
        return;
      }
      if (run.status !== TestRunStatus.QUEUED) {
        this.logger.warn(`Skipping test run ${testRunId} because it is ${run.status}`);
        return;
      }
      if (!run.environmentConfigRevision) {
        throw new Error('Environment config revision is required before running tests');
      }
      if (run.suiteRevisions.length === 0) {
        throw new Error('At least one test suite revision is required');
      }

      try {
        await this.state.claim(testRunId, {
          runnerId: this.runnerId,
          leaseDurationMs: this.leaseDurationMs(),
        });
      } catch (error) {
        if (error instanceof Error && /active execution lease/i.test(error.message)) {
          if (await this.isCancellationRequested(testRunId)) {
            throw new TestRunCancellationError();
          }
          this.logger.warn(`Skipping test run ${testRunId} because another worker owns its lease`);
          return;
        }
        throw error;
      }
      context = this.createExecutionContext(testRunId);
      await this.ensureNotCancelled(testRunId, context);

      await this.state.enterPhase(testRunId, TestRunStatus.PREPARING_WORKSPACE);
      workspace = await this.createWorkspace(testRunId);
      await this.log(testRunId, RunnerLogSource.SYSTEM, 'Preparing isolated local workspace');
      this.emit('run.started', testRunId);

      const environmentConfig = run.environmentConfigRevision;
      secretContext = await this.secrets.resolveForRun(
        run.projectId,
        run.project.companyId,
        testRunId,
        environmentConfig,
        run.suiteRevisions.map((suiteRevision) => suiteRevision.testSuiteRevision),
      );
      const testSuites = run.suiteRevisions.map((suiteRevision) => ({
        id: suiteRevision.testSuiteRevisionId,
        name: suiteRevision.suiteName,
        yamlContent: this.secrets.replaceReferences(
          suiteRevision.testSuiteRevision.compiledYaml,
          secretContext.secrets,
        ),
        executionPlan: this.secrets.replaceReferences(
          suiteRevision.testSuiteRevision.executionPlan,
          secretContext.secrets,
        ),
      }));
      await this.state.enterPhase(testRunId, TestRunStatus.VALIDATING_ENVIRONMENT);
      const composeYaml = this.secrets.replaceReferences(
        environmentConfig.compiledComposeYaml,
        secretContext.secrets,
      );
      const runtimeYaml = this.secrets.replaceReferences(
        environmentConfig.compiledRuntimeYaml,
        secretContext.secrets,
      );
      this.docker.validateCompose(composeYaml);
      await writeFile(join(workspace, 'docker-compose.test.yml'), composeYaml);
      await writeFile(join(workspace, 'backend-test.yml'), runtimeYaml);
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
      const stats = await this.executeSuites(
        testRunId,
        run.project.baseUrl,
        testSuites,
        context,
        secretContext,
      );
      await this.state.enterPhase(testRunId, TestRunStatus.COLLECTING_ARTIFACTS);
      const dockerLogs = await this.safeDockerLogs(workspace);
      if (dockerLogs) {
        await this.log(testRunId, RunnerLogSource.DOCKER, dockerLogs, secretContext);
        this.emit('logs.updated', testRunId);
      }

      await this.state.enterPhase(testRunId, TestRunStatus.CLEANING_UP);
      let cleanupError: string | undefined;
      if (workspace) {
        cleanupError = await this.cleanupWorkspace(testRunId, workspace, secretContext);
        workspace = '';
      }

      if (await this.isCancellationRequested(testRunId)) {
        await this.state.markCancelled(testRunId, Date.now() - started, cleanupError);
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
      await this.generateReport(testRunId);
    } catch (error) {
      const message = this.masking.maskString(
        error instanceof Error ? error.message : 'Runner failed',
        secretContext.masking,
      );
      await this.log(testRunId, RunnerLogSource.ERROR, message, secretContext).catch(
        () => undefined,
      );
      if (
        error instanceof TestRunCancellationError ||
        (await this.isCancellationRequested(testRunId))
      ) {
        await this.state.requestCancel(testRunId).catch(() => undefined);
        const cleanupError = workspace
          ? await this.cleanupWorkspace(testRunId, workspace, secretContext).catch(
              (cleanupFailure) =>
                this.masking.maskString(String(cleanupFailure), secretContext.masking),
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
      await this.generateReport(testRunId);
    } finally {
      context?.stop();
      if (workspace) {
        this.emit('environment.stopping', testRunId);
        await this.docker
          .down(workspace)
          .catch((error) =>
            this.log(testRunId, RunnerLogSource.ERROR, String(error), secretContext),
          );
        await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
      }
      this.emit('run.finished', testRunId);
    }
  }

  private async executeSuites(
    testRunId: string,
    baseUrl: string,
    suites: { id: string; name: string; yamlContent: string; executionPlan: unknown }[],
    context: RunExecutionContext,
    secretContext: SecretExecutionContext,
  ): Promise<{ totalTests: number; passedTests: number; failedTests: number }> {
    const store = this.variables.create();
    const responseStore = new Map<string, unknown>();
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const suiteRecord of suites) {
      const plan = this.resolveExecutionPlan(suiteRecord);
      for (const test of plan.steps.filter((step) => step.type !== 'sequence')) {
        await this.ensureNotCancelled(testRunId, context);
        totalTests += 1;
        const stepMeta = this.getStepMeta(test);
        this.emit('test.started', testRunId, {
          suiteName: plan.suiteName,
          testName: test.name,
          ...this.masking.maskValue(stepMeta, secretContext.masking),
        });
        const result = await this.executeStep(
          testRunId,
          baseUrl,
          test,
          store,
          responseStore,
          context,
          secretContext,
        );
        if (result.responseBody !== undefined) {
          responseStore.set(test.id, result.responseBody);
        }
        const passed = result.status === TestResultStatus.PASSED;
        passedTests += passed ? 1 : 0;
        failedTests += passed ? 0 : 1;
        const maskedResponse = this.masking.maskValue(result.responseBody, secretContext.masking);
        const responseArtifact = await this.persistResponseArtifact(
          testRunId,
          stepMeta.stepId,
          maskedResponse,
        );
        const responsePreview = previewJson(maskedResponse, this.artifacts.previewLimitBytes());
        await this.prisma.testResult.create({
          data: {
            testRunId,
            stepId: stepMeta.stepId,
            stepType: stepMeta.stepType,
            suiteName: plan.suiteName,
            testName: test.name,
            status: result.status,
            method: stepMeta.method,
            path: stepMeta.path,
            expectedStatus: stepMeta.expectedStatus,
            actualStatus: result.actualStatus,
            attempts: result.attempts,
            durationMs: result.durationMs,
            requestBody: this.toJsonValue(
              this.masking.maskValue(stepMeta.requestBody, secretContext.masking),
            ),
            responsePreview: this.toJsonValue(responsePreview.preview),
            responsePreviewTruncated: responsePreview.truncated,
            responseArtifactId: responseArtifact?.id,
            errorMessage: result.errorMessage
              ? this.masking.maskString(result.errorMessage, secretContext.masking)
              : undefined,
          },
        });
        this.emit(passed ? 'test.passed' : 'test.failed', testRunId, {
          suiteName: plan.suiteName,
          testName: test.name,
          ...this.masking.maskValue(stepMeta, secretContext.masking),
          attempts: result.attempts,
          errorMessage: result.errorMessage
            ? this.masking.maskString(result.errorMessage, secretContext.masking)
            : undefined,
        });
      }
    }
    return { totalTests, passedTests, failedTests };
  }

  private resolveExecutionPlan(suite: {
    id: string;
    name: string;
    yamlContent: string;
    executionPlan: unknown;
  }): ExecutionPlan {
    if (this.isExecutionPlan(suite.executionPlan)) {
      return suite.executionPlan;
    }
    return this.executionPlanCompiler.compileRawYaml(suite.yamlContent, {
      suiteRevisionId: suite.id,
    }).executionPlan;
  }

  private isExecutionPlan(value: unknown): value is ExecutionPlan {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const plan = value as Partial<ExecutionPlan>;
    return (
      plan.schemaVersion === 'execution-plan/v1' &&
      typeof plan.suiteName === 'string' &&
      Array.isArray(plan.steps) &&
      !!plan.dependencies &&
      typeof plan.dependencies === 'object'
    );
  }

  private async executeStep(
    testRunId: string,
    baseUrl: string,
    test: ExecutionStep,
    store: Map<string, string>,
    responseStore: Map<string, unknown>,
    context: RunExecutionContext,
    secretContext: SecretExecutionContext,
  ): Promise<StepExecutionResult> {
    if (test.type === 'sequence') {
      return {
        status: TestResultStatus.PASSED,
        durationMs: 0,
        attempts: 1,
        responseBody: { stepIds: test.config.stepIds },
      };
    }

    if (test.type === 'wait') {
      return this.executeWait(testRunId, test, context);
    }

    if (test.type === 'pollUntil') {
      return this.executePoll(testRunId, baseUrl, test, store, context, secretContext);
    }

    if (test.type === 'setVariable') {
      return this.executeSetVariable(test, store);
    }

    if (test.type === 'assert') {
      return this.executeAssert(test, responseStore);
    }

    return this.executeRequest(
      testRunId,
      baseUrl,
      test.name,
      test.config,
      store,
      context,
      secretContext,
    );
  }

  private async executeRequest(
    testRunId: string,
    baseUrl: string,
    name: string,
    requestDefinition: ApiRequestStepConfig,
    store: Map<string, string>,
    context: RunExecutionContext,
    secretContext: SecretExecutionContext,
  ): Promise<StepExecutionResult> {
    const request = this.variables.interpolate(requestDefinition, store, secretContext.secrets);
    const result = await this.http.execute(
      baseUrl,
      { name, request },
      store,
      secretContext.secrets,
      context.signal,
    );
    await this.ensureNotCancelled(testRunId, context);
    return this.evaluateRequestResult(result, request, store, 1);
  }

  private async executePoll(
    testRunId: string,
    baseUrl: string,
    test: PollUntilExecutionStep,
    store: Map<string, string>,
    context: RunExecutionContext,
    secretContext: SecretExecutionContext,
  ): Promise<StepExecutionResult> {
    const started = Date.now();
    const timeoutMs = test.config.timeoutMs;
    const intervalMs = test.config.intervalMs;
    let attempts = 0;
    let lastResult: StepExecutionResult | undefined;

    while (Date.now() - started <= timeoutMs) {
      await this.ensureNotCancelled(testRunId, context);
      attempts += 1;
      const request = this.variables.interpolate(test.config.request, store, secretContext.secrets);
      const httpResult = await this.http.execute(
        baseUrl,
        { name: test.name, request },
        store,
        secretContext.secrets,
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
        test.config.failureMessage ??
        `Poll timed out after ${Math.round(timeoutMs / 1000)} seconds`,
    };
  }

  private async executeWait(
    testRunId: string,
    test: WaitExecutionStep,
    context: RunExecutionContext,
  ): Promise<StepExecutionResult> {
    const started = Date.now();
    await this.sleep(test.config.durationMs, testRunId, context);
    return {
      status: TestResultStatus.PASSED,
      durationMs: Date.now() - started,
      attempts: 1,
      responseBody: { waitedMs: test.config.durationMs },
    };
  }

  private executeSetVariable(
    test: Extract<ExecutionStep, { type: 'setVariable' }>,
    store: Map<string, string>,
  ): StepExecutionResult {
    const value = test.config.value ?? '';
    store.set(test.config.name, value);
    return {
      status: TestResultStatus.PASSED,
      durationMs: 0,
      attempts: 1,
      responseBody: { name: test.config.name, value },
    };
  }

  private executeAssert(
    test: AssertExecutionStep,
    responseStore: Map<string, unknown>,
  ): StepExecutionResult {
    const payload = this.resolveAssertPayload(test, responseStore);
    const assertionResult = this.assertions.evaluateAssertions(payload, [
      {
        field_path: test.config.fieldPath,
        operator: test.config.operator,
        expected_value: test.config.expectedValue,
      },
    ]);
    return {
      status: assertionResult.passed ? TestResultStatus.PASSED : TestResultStatus.FAILED,
      durationMs: 0,
      attempts: 1,
      responseBody: payload,
      errorMessage: assertionResult.message,
    };
  }

  private resolveAssertPayload(
    test: AssertExecutionStep,
    responseStore: Map<string, unknown>,
  ): unknown {
    if (test.config.sourceStepId) {
      return responseStore.get(test.config.sourceStepId);
    }
    const responses = [...responseStore.values()];
    return responses[responses.length - 1];
  }

  private evaluateRequestResult(
    result: HttpExecutionResult,
    request: ApiRequestStepConfig,
    store: Map<string, string>,
    attempts: number,
  ): StepExecutionResult {
    const expectedStatus = request.expect?.status ?? 200;
    const statusMatches = result.actualStatus === expectedStatus;
    const bodyMatches = this.assertions.contains(result.responseBody, request.expect?.jsonContains);
    const assertionResult = this.assertions.evaluateAssertions(
      result.responseBody,
      request.expect?.assertions?.map((assertion) => ({
        field_path: assertion.fieldPath,
        operator: assertion.operator,
        expected_value: assertion.expectedValue,
      })),
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

  private getStepMeta(test: ExecutionStep) {
    if (test.type === 'sequence') {
      return {
        stepId: test.id,
        stepType: test.type,
        method: 'SEQUENCE',
        path: test.id,
        expectedStatus: 0,
        requestBody: test.config,
      };
    }

    if (test.type === 'wait') {
      return {
        stepId: test.id,
        stepType: test.type,
        method: 'WAIT',
        path: 'delay',
        expectedStatus: 0,
        requestBody: { durationMs: test.config.durationMs },
      };
    }

    if (test.type === 'pollUntil') {
      return {
        stepId: test.id,
        stepType: test.type,
        method: test.config.request.method.toUpperCase(),
        path: test.config.request.path,
        expectedStatus: test.config.request.expect?.status ?? 200,
        requestBody: test.config.request.json,
      };
    }

    if (test.type === 'setVariable') {
      return {
        stepId: test.id,
        stepType: test.type,
        method: 'SET',
        path: test.config.name,
        expectedStatus: 0,
        requestBody: test.config,
      };
    }

    if (test.type === 'assert') {
      return {
        stepId: test.id,
        stepType: test.type,
        method: 'ASSERT',
        path: test.config.fieldPath,
        expectedStatus: 0,
        requestBody: test.config,
      };
    }

    return {
      stepId: test.id,
      stepType: test.type,
      method: test.config.method.toUpperCase(),
      path: test.config.path,
      expectedStatus: test.config.expect?.status ?? 200,
      requestBody: test.config.json,
    };
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

  private async log(
    testRunId: string,
    source: RunnerLogSource,
    message: string,
    secretContext?: SecretExecutionContext,
  ): Promise<void> {
    const masked = secretContext
      ? this.masking.maskString(message, secretContext.masking)
      : message;
    await this.logs.append(testRunId, source, masked);
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
      try {
        if (await this.state.isCancellationRequested(testRunId)) {
          controller.abort(new TestRunCancellationError());
        }
      } catch (error) {
        this.logger.warn(
          `Failed to poll cancellation for test run ${testRunId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    };

    const renewLease = async () => {
      if (stopped || controller.signal.aborted) {
        return;
      }
      try {
        const renewed = await this.state.renewLease(
          testRunId,
          this.runnerId,
          this.leaseDurationMs(),
        );
        if (!renewed) {
          controller.abort(new Error('Test run execution lease was lost'));
        }
      } catch (error) {
        controller.abort(new Error('Test run execution lease was lost'));
        this.logger.warn(
          `Failed to renew lease for test run ${testRunId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
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
    secretContext: SecretExecutionContext,
  ): Promise<string | undefined> {
    this.emit('environment.stopping', testRunId);
    let cleanupError: string | undefined;
    await this.docker.down(workspace).catch(async (error) => {
      cleanupError = error instanceof Error ? error.message : String(error);
      await this.log(testRunId, RunnerLogSource.ERROR, cleanupError, secretContext).catch(
        () => undefined,
      );
    });
    await rm(workspace, { recursive: true, force: true }).catch((error) => {
      cleanupError = this.masking.maskString(
        error instanceof Error ? error.message : String(error),
        secretContext.masking,
      );
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

  private async persistResponseArtifact(
    testRunId: string,
    stepId: string | undefined,
    responseBody: unknown,
  ) {
    if (responseBody === undefined) {
      return null;
    }
    const objectStepId = sanitizeArtifactKeySegment(stepId, 'unknown-step');
    return this.artifacts.putOrReplace({
      testRunId,
      stepId,
      type: ArtifactType.RESPONSE_BODY,
      objectKey: `runs/${testRunId}/responses/${objectStepId}.json.gz`,
      mimeType: 'application/json',
      data: toJsonBuffer(responseBody),
      compression: ArtifactCompression.GZIP,
      retentionUntil: this.artifacts.retentionUntil(),
    });
  }

  private async generateReport(testRunId: string): Promise<void> {
    await this.reports.generateForRun(testRunId).catch((error) => {
      this.logger.warn(
        `Failed to generate report artifacts for test run ${testRunId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  private toJsonValue(value: unknown) {
    return value === undefined ? undefined : (value as object);
  }
}
