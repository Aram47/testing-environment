import { TestRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunStateService } from '../test-runs/test-run-state.service';
import { RealtimeService } from '../websocket/realtime.service';
import { AssertionEngineService } from './assertion-engine.service';
import { DockerComposeManagerService } from './docker-compose-manager.service';
import { HealthcheckService } from './healthcheck.service';
import { HttpTestExecutorService } from './http-test-executor.service';
import { RunnerOrchestratorService } from './runner-orchestrator.service';
import { VariableStoreService } from './variable-store.service';
import { YamlTestParserService } from './yaml-test-parser.service';

describe('RunnerOrchestratorService', () => {
  it('skips duplicate execution when a run is no longer pending', async () => {
    const prisma = {
      testRun: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'run-1',
            status: TestRunStatus.CLAIMED,
            project: {
              environmentConfig: {
                composeYaml: 'services: {}\n',
                backendTestYaml: 'version: "1.0"\n',
              },
              testSuites: [],
            },
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
    );

    await service.execute('run-1');

    expect(docker.validateCompose).not.toHaveBeenCalled();
    expect(docker.up).not.toHaveBeenCalled();
    expect(prisma.testRun.update).not.toHaveBeenCalled();
    expect(prisma.testRun.updateMany).not.toHaveBeenCalled();
  });
});
