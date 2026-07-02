import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RunnerLogSource, TestResultStatus, TestRunStatus } from '@prisma/client';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../websocket/realtime.service';
import { AssertionEngineService } from './assertion-engine.service';
import { DockerComposeManagerService } from './docker-compose-manager.service';
import { HealthcheckService } from './healthcheck.service';
import { HttpTestExecutorService } from './http-test-executor.service';
import { YamlTestCase } from './types/yaml-test.types';
import { VariableStoreService } from './variable-store.service';
import { YamlTestParserService } from './yaml-test-parser.service';

@Injectable()
export class RunnerOrchestratorService {
  private readonly logger = new Logger(RunnerOrchestratorService.name);
  private readonly cancelledRuns = new Set<string>();

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
  ) {}

  start(testRunId: string): void {
    void this.execute(testRunId).catch((error) => this.logger.error(error));
  }

  cancel(testRunId: string): void {
    this.cancelledRuns.add(testRunId);
  }

  private async execute(testRunId: string): Promise<void> {
    const started = Date.now();
    let workspace = '';
    try {
      const run = await this.prisma.testRun.findUnique({
        where: { id: testRunId },
        include: { project: { include: { environmentConfig: true, testSuites: true } } },
      });
      if (!run) {
        throw new NotFoundException('Test run not found');
      }
      if (!run.project.environmentConfig) {
        throw new Error('Environment config is required before running tests');
      }
      if (run.project.testSuites.length === 0) {
        throw new Error('At least one test suite is required');
      }

      workspace = await this.createWorkspace(testRunId);
      await this.markRunning(testRunId);
      await this.log(testRunId, RunnerLogSource.SYSTEM, 'Preparing isolated local workspace');
      this.emit('run.started', testRunId);

      const { environmentConfig, testSuites } = run.project;
      this.docker.validateCompose(environmentConfig.composeYaml);
      await writeFile(join(workspace, 'docker-compose.test.yml'), environmentConfig.composeYaml);
      await writeFile(join(workspace, 'backend-test.yml'), environmentConfig.backendTestYaml);
      await mkdir(join(workspace, 'tests'), { recursive: true });
      for (const suite of testSuites) {
        await writeFile(join(workspace, 'tests', `${suite.id}.yml`), suite.yamlContent);
      }

      this.ensureNotCancelled(testRunId);
      this.emit('environment.starting', testRunId);
      await this.log(testRunId, RunnerLogSource.SYSTEM, 'Starting docker compose environment');
      await this.docker.up(workspace);

      this.ensureNotCancelled(testRunId);
      await this.healthcheck.waitFor(
        run.project.baseUrl,
        run.project.healthcheckPath,
        run.project.healthcheckExpectedStatus,
        run.project.healthcheckTimeoutSeconds,
      );
      this.emit('environment.ready', testRunId);

      const stats = await this.executeSuites(testRunId, run.project.baseUrl, testSuites);
      const dockerLogs = await this.safeDockerLogs(workspace);
      if (dockerLogs) {
        await this.log(testRunId, RunnerLogSource.DOCKER, dockerLogs.slice(-20000));
        this.emit('logs.updated', testRunId);
      }

      const status = this.cancelledRuns.has(testRunId)
        ? TestRunStatus.CANCELLED
        : stats.failedTests > 0
          ? TestRunStatus.FAILED
          : TestRunStatus.PASSED;
      await this.finish(testRunId, status, started, stats);
    } catch (error) {
      const status = this.cancelledRuns.has(testRunId) ? TestRunStatus.CANCELLED : TestRunStatus.FAILED;
      const message = error instanceof Error ? error.message : 'Runner failed';
      await this.log(testRunId, RunnerLogSource.ERROR, message).catch(() => undefined);
      await this.finish(testRunId, status, started, undefined, message).catch(() => undefined);
    } finally {
      if (workspace) {
        this.emit('environment.stopping', testRunId);
        await this.docker.down(workspace).catch((error) => this.log(testRunId, RunnerLogSource.ERROR, String(error)));
        await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
      }
      this.cancelledRuns.delete(testRunId);
      this.emit('run.finished', testRunId);
    }
  }

  private async executeSuites(
    testRunId: string,
    baseUrl: string,
    suites: { name: string; yamlContent: string }[],
  ): Promise<{ totalTests: number; passedTests: number; failedTests: number }> {
    const store = this.variables.create();
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const suiteRecord of suites) {
      const suite = this.parser.parseSuite(suiteRecord.yamlContent);
      for (const test of suite.tests) {
        this.ensureNotCancelled(testRunId);
        totalTests += 1;
        this.emit('test.started', testRunId, { suiteName: suite.suite, testName: test.name });
        const result = await this.executeTest(baseUrl, test, store);
        const passed = result.status === TestResultStatus.PASSED;
        passedTests += passed ? 1 : 0;
        failedTests += passed ? 0 : 1;
        await this.prisma.testResult.create({
          data: {
            testRunId,
            suiteName: suite.suite,
            testName: test.name,
            status: result.status,
            method: test.request.method.toUpperCase(),
            path: test.request.path,
            expectedStatus: test.request.expect?.status ?? 200,
            actualStatus: result.actualStatus,
            durationMs: result.durationMs,
            requestBody: this.toJsonValue(test.request.json),
            responseBody: this.toJsonValue(result.responseBody),
            errorMessage: result.errorMessage,
          },
        });
        this.emit(passed ? 'test.passed' : 'test.failed', testRunId, {
          suiteName: suite.suite,
          testName: test.name,
          errorMessage: result.errorMessage,
        });
      }
    }
    return { totalTests, passedTests, failedTests };
  }

  private async executeTest(baseUrl: string, test: YamlTestCase, store: Map<string, string>) {
    const request = this.variables.interpolate(test.request, store);
    const result = await this.http.execute(baseUrl, { ...test, request }, store);
    const expectedStatus = request.expect?.status ?? 200;
    const statusMatches = result.actualStatus === expectedStatus;
    const bodyMatches = this.assertions.contains(result.responseBody, request.expect?.json_contains);
    const passed = !result.errorMessage && statusMatches && bodyMatches;
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
      errorMessage:
        result.errorMessage ??
        (!statusMatches ? `Expected status ${expectedStatus}, got ${result.actualStatus}` : undefined) ??
        (!bodyMatches ? 'Response body does not contain expected JSON' : undefined),
    };
  }

  private async createWorkspace(testRunId: string): Promise<string> {
    const root = this.config.get<string>('RUNNER_WORKSPACE_ROOT', '/tmp/backend-test-runner');
    const workspace = join(root, testRunId);
    await mkdir(workspace, { recursive: true });
    return workspace;
  }

  private async markRunning(testRunId: string): Promise<void> {
    await this.prisma.testRun.update({
      where: { id: testRunId },
      data: { status: TestRunStatus.RUNNING, startedAt: new Date() },
    });
  }

  private async finish(
    testRunId: string,
    status: TestRunStatus,
    started: number,
    stats?: { totalTests: number; passedTests: number; failedTests: number },
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status,
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        errorMessage,
        ...(stats ?? {}),
      },
    });
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

  private ensureNotCancelled(testRunId: string): void {
    if (this.cancelledRuns.has(testRunId)) {
      throw new Error('Test run was cancelled');
    }
  }

  private emit(type: string, testRunId: string, payload?: Record<string, unknown>): void {
    this.realtime.emitRunEvent({ type, testRunId, payload });
  }

  private toJsonValue(value: unknown) {
    return value === undefined ? undefined : (value as object);
  }
}
