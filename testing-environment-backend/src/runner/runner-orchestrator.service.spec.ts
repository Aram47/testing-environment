import { TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecretMaskingService } from '../secrets/secret-masking.service';
import { SecretReferenceResolverService } from '../secrets/secret-reference-resolver.service';
import { ExecutionPlanCompilerService } from '../test-suites/execution-plan-compiler.service';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { RealtimeService } from '../websocket/realtime.service';
import { ArtifactLogWriterService } from '../artifacts/artifact-log-writer.service';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { ReportArtifactService } from '../artifacts/report-artifact.service';
import { AssertionEngineService } from './assertion-engine.service';
import { DockerComposeManagerService } from './docker-compose-manager.service';
import { HealthcheckService } from './healthcheck.service';
import { HttpTestExecutorService } from './http-test-executor.service';
import { RunnerOrchestratorService } from './runner-orchestrator.service';
import { VariableStoreService } from './variable-store.service';
import { YamlTestParserService } from './yaml-test-parser.service';

describe('RunnerOrchestratorService', () => {
  const createService = (overrides: Partial<{ compiler: { compileRawYaml: jest.Mock } }> = {}) =>
    new RunnerOrchestratorService(
      {
        testRun: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
        runnerLog: { create: jest.fn() },
      } as unknown as PrismaService,
      { get: jest.fn((_key: string, fallback: unknown) => fallback) } as never,
      {
        up: jest.fn(),
        down: jest.fn(),
        logs: jest.fn(),
        validateCompose: jest.fn(),
      } as unknown as DockerComposeManagerService,
      { waitFor: jest.fn() } as unknown as HealthcheckService,
      { parseSuite: jest.fn() } as unknown as YamlTestParserService,
      (overrides.compiler ?? {
        compileRawYaml: jest.fn(),
      }) as unknown as ExecutionPlanCompilerService,
      { execute: jest.fn() } as unknown as HttpTestExecutorService,
      {
        contains: jest.fn(),
        evaluateAssertions: jest.fn(),
        readJsonPath: jest.fn(),
      } as unknown as AssertionEngineService,
      { create: jest.fn() } as unknown as VariableStoreService,
      { emitRunEvent: jest.fn() } as unknown as RealtimeService,
      {
        claim: jest.fn(),
        enterPhase: jest.fn(),
        markPassed: jest.fn(),
        markTestFailed: jest.fn(),
        markInfraFailed: jest.fn(),
        markTimedOut: jest.fn(),
        requestCancel: jest.fn(),
        markCancelled: jest.fn(),
        isCancellationRequested: jest.fn(() => Promise.resolve(false)),
        renewLease: jest.fn(() => Promise.resolve(true)),
      } as unknown as TestRunStateService,
      {
        resolveForRun: jest.fn(),
        replaceReferences: jest.fn((value) => value),
      } as unknown as SecretReferenceResolverService,
      {
        emptyContext: jest.fn(() => ({ values: [] })),
        maskString: jest.fn((value: string) => value),
        maskValue: jest.fn((value: unknown) => value),
      } as unknown as SecretMaskingService,
      {
        putOrReplace: jest.fn(),
        previewLimitBytes: jest.fn(() => 16 * 1024),
        retentionUntil: jest.fn(() => new Date('2026-08-01T00:00:00.000Z')),
      } as unknown as ArtifactsService,
      { append: jest.fn() } as unknown as ArtifactLogWriterService,
      { generateForRun: jest.fn() } as unknown as ReportArtifactService,
    );

  it('uses stored execution plans before legacy YAML fallback', () => {
    const compiler = { compileRawYaml: jest.fn() };
    const service = createService({ compiler }) as unknown as {
      resolveExecutionPlan: (suite: {
        id: string;
        name: string;
        yamlContent: string;
        executionPlan: unknown;
      }) => unknown;
    };
    const plan = {
      schemaVersion: 'execution-plan/v1',
      suiteRevisionId: 'revision-1',
      suiteName: 'Stored',
      steps: [],
      dependencies: {},
      variables: [],
      timeoutMs: 300000,
    };

    expect(
      service.resolveExecutionPlan({
        id: 'revision-1',
        name: 'Stored',
        yamlContent: 'suite: Stored\ntests: []\n',
        executionPlan: plan,
      }),
    ).toBe(plan);
    expect(compiler.compileRawYaml).not.toHaveBeenCalled();
  });

  it('skips duplicate execution when a run is no longer pending', async () => {
    const prisma = {
      testRun: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'run-1',
            status: TestRunStatus.CLAIMED,
            project: {},
            environmentConfigRevision: {
              compiledComposeYaml: 'services: {}\n',
              compiledRuntimeYaml: 'version: "1.0"\n',
            },
            suiteRevisions: [],
          })
          .mockResolvedValueOnce({
            status: TestRunStatus.CLAIMED,
            cancellationRequestedAt: null,
          }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      runnerLog: {
        create: jest.fn(),
      },
    };
    const docker = {
      up: jest.fn(),
      down: jest.fn(),
      logs: jest.fn(),
      validateCompose: jest.fn(),
    };

    const service = new RunnerOrchestratorService(
      prisma as unknown as PrismaService,
      { get: jest.fn((_key: string, fallback: unknown) => fallback) } as never,
      docker as unknown as DockerComposeManagerService,
      { waitFor: jest.fn() } as unknown as HealthcheckService,
      { parseSuite: jest.fn() } as unknown as YamlTestParserService,
      { compileRawYaml: jest.fn() } as unknown as ExecutionPlanCompilerService,
      { execute: jest.fn() } as unknown as HttpTestExecutorService,
      {
        contains: jest.fn(),
        evaluateAssertions: jest.fn(),
        readJsonPath: jest.fn(),
      } as unknown as AssertionEngineService,
      { create: jest.fn() } as unknown as VariableStoreService,
      { emitRunEvent: jest.fn() } as unknown as RealtimeService,
      {
        claim: jest.fn(),
        enterPhase: jest.fn(),
        markPassed: jest.fn(),
        markTestFailed: jest.fn(),
        markInfraFailed: jest.fn(),
        markTimedOut: jest.fn(),
        requestCancel: jest.fn(),
        markCancelled: jest.fn(),
        isCancellationRequested: jest.fn(() => Promise.resolve(false)),
        renewLease: jest.fn(() => Promise.resolve(true)),
      } as unknown as TestRunStateService,
      {
        resolveForRun: jest.fn(),
        replaceReferences: jest.fn((value) => value),
      } as unknown as SecretReferenceResolverService,
      {
        emptyContext: jest.fn(() => ({ values: [] })),
        maskString: jest.fn((value: string) => value),
        maskValue: jest.fn((value: unknown) => value),
      } as unknown as SecretMaskingService,
      {
        putOrReplace: jest.fn(),
        previewLimitBytes: jest.fn(() => 16 * 1024),
        retentionUntil: jest.fn(() => new Date('2026-08-01T00:00:00.000Z')),
      } as unknown as ArtifactsService,
      { append: jest.fn() } as unknown as ArtifactLogWriterService,
      { generateForRun: jest.fn() } as unknown as ReportArtifactService,
    );

    await service.execute('run-1');

    expect(docker.validateCompose).not.toHaveBeenCalled();
    expect(docker.up).not.toHaveBeenCalled();
    expect(prisma.testRun.update).not.toHaveBeenCalled();
    expect(prisma.testRun.updateMany).not.toHaveBeenCalled();
  });
});
