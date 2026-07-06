import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EnvironmentConfigType,
  EnvironmentDryRunFailureCategory,
  EnvironmentDryRunStatus,
  RunnerLogSource,
} from '@prisma/client';
import { mkdir, rm, writeFile } from 'fs/promises';
import { hostname } from 'os';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { PrismaService } from '../prisma/prisma.service';
import { DockerComposeManagerService } from '../runner/docker-compose-manager.service';
import { HealthcheckService } from '../runner/healthcheck.service';
import {
  SecretExecutionContext,
  SecretReferenceResolverService,
} from '../secrets/secret-reference-resolver.service';
import { SecretMaskingService } from '../secrets/secret-masking.service';
import { EnvironmentDryRunStateService } from './environment-dry-run-state.service';

interface RuntimeConfig {
  baseUrl: string;
  healthcheckPath: string;
  healthcheckExpectedStatus: number;
  healthcheckTimeoutSeconds: number;
}

@Injectable()
export class EnvironmentDryRunOrchestratorService {
  private readonly logger = new Logger(EnvironmentDryRunOrchestratorService.name);
  private readonly runnerId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly docker: DockerComposeManagerService,
    private readonly healthcheck: HealthcheckService,
    private readonly state: EnvironmentDryRunStateService,
    private readonly secrets: SecretReferenceResolverService,
    private readonly masking: SecretMaskingService,
  ) {
    this.runnerId = this.config.get<string>('TEST_RUN_RUNNER_ID') ?? `${hostname()}-${process.pid}`;
  }

  async execute(dryRunId: string): Promise<void> {
    let workspace = '';
    let secretContext: SecretExecutionContext = {
      secrets: new Map(),
      masking: this.masking.emptyContext(),
    };
    try {
      const dryRun = await this.prisma.environmentDryRun.findUnique({
        where: { id: dryRunId },
        include: {
          environmentConfigRevision: {
            include: { environmentConfig: true },
          },
          project: { select: { companyId: true, baseUrl: true } },
        },
      });
      if (!dryRun) {
        return;
      }

      const revision = dryRun.environmentConfigRevision;
      const usesDockerCompose =
        revision.environmentConfig.type === EnvironmentConfigType.DOCKER_COMPOSE;

      secretContext = await this.secrets.resolveForRun(
        dryRun.projectId,
        dryRun.project.companyId,
        dryRunId,
        revision,
        [],
      );

      await this.state.enterPhase(dryRunId, EnvironmentDryRunStatus.PREPARING_WORKSPACE);
      workspace = await this.createWorkspace(dryRunId);
      await this.log(dryRunId, RunnerLogSource.SYSTEM, 'Preparing isolated workspace', secretContext);

      await this.state.enterPhase(dryRunId, EnvironmentDryRunStatus.VALIDATING_ENVIRONMENT);
      const composeYaml = this.secrets.replaceReferences(
        revision.compiledComposeYaml,
        secretContext.secrets,
      );
      const runtimeYaml = this.secrets.replaceReferences(
        revision.compiledRuntimeYaml,
        secretContext.secrets,
      );
      if (usesDockerCompose) {
        this.docker.validateCompose(composeYaml);
        await writeFile(join(workspace, 'docker-compose.test.yml'), composeYaml);
      }
      await writeFile(join(workspace, 'backend-test.yml'), runtimeYaml);
      const runtimeConfig = this.parseRuntimeConfig(runtimeYaml, dryRun.project.baseUrl);

      if (await this.state.isCancellationRequested(dryRunId)) {
        await this.state.markCancelled(dryRunId, 'Dry run cancelled');
        return;
      }

      if (usesDockerCompose) {
        await this.state.enterPhase(dryRunId, EnvironmentDryRunStatus.PULLING_IMAGES);
        await this.log(dryRunId, RunnerLogSource.SYSTEM, 'Preparing docker images', secretContext);
        await this.state.enterPhase(dryRunId, EnvironmentDryRunStatus.STARTING_ENVIRONMENT);
        await this.log(dryRunId, RunnerLogSource.SYSTEM, 'Starting docker compose environment', secretContext);
        await this.docker.up(workspace);
      }

      await this.state.enterPhase(dryRunId, EnvironmentDryRunStatus.WAITING_FOR_HEALTHCHECK);
      await this.healthcheck.waitFor(
        runtimeConfig.baseUrl,
        runtimeConfig.healthcheckPath,
        runtimeConfig.healthcheckExpectedStatus,
        runtimeConfig.healthcheckTimeoutSeconds,
      );

      await this.state.enterPhase(dryRunId, EnvironmentDryRunStatus.COLLECTING_LOGS);
      if (usesDockerCompose) {
        const dockerLogs = await this.docker.logs(workspace).catch(() => '');
        if (dockerLogs) {
          await this.log(dryRunId, RunnerLogSource.DOCKER, dockerLogs, secretContext);
        }
      }

      await this.state.enterPhase(dryRunId, EnvironmentDryRunStatus.CLEANING_UP);
      if (usesDockerCompose && workspace) {
        await this.docker.down(workspace).catch((error) =>
          this.log(
            dryRunId,
            RunnerLogSource.ERROR,
            error instanceof Error ? error.message : 'Cleanup failed',
            secretContext,
          ),
        );
      }

      if (await this.state.isCancellationRequested(dryRunId)) {
        await this.state.markCancelled(dryRunId, 'Dry run cancelled');
        return;
      }

      await this.state.markPassed(dryRunId);
    } catch (error) {
      const message = this.masking.maskString(
        error instanceof Error ? error.message : 'Dry run failed',
        secretContext.masking,
      );
      await this.log(dryRunId, RunnerLogSource.ERROR, message, secretContext).catch(() => undefined);
      if (await this.state.isCancellationRequested(dryRunId)) {
        await this.state.markCancelled(dryRunId, message).catch(() => undefined);
        return;
      }
      await this.state
        .markInfraFailed(dryRunId, EnvironmentDryRunFailureCategory.INTERNAL, message)
        .catch(() => undefined);
      this.logger.error(`Environment dry run ${dryRunId} failed: ${message}`);
    } finally {
      if (workspace) {
        await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  private parseRuntimeConfig(runtimeYaml: string, fallbackBaseUrl: string): RuntimeConfig {
    const parsed = yaml.load(runtimeYaml) as Record<string, unknown>;
    const app = (parsed?.app as Record<string, unknown>) ?? {};
    const healthcheck = (app.healthcheck as Record<string, unknown>) ?? {};
    return {
      baseUrl: typeof app.base_url === 'string' ? app.base_url : fallbackBaseUrl,
      healthcheckPath:
        typeof healthcheck.path === 'string' ? healthcheck.path : '/health',
      healthcheckExpectedStatus:
        typeof healthcheck.expected_status === 'number' ? healthcheck.expected_status : 200,
      healthcheckTimeoutSeconds:
        typeof healthcheck.timeout_seconds === 'number' ? healthcheck.timeout_seconds : 60,
    };
  }

  private async createWorkspace(dryRunId: string): Promise<string> {
    const root = this.config.get<string>('TEST_RUN_WORKSPACE_ROOT') ?? '/tmp/testing-environment-runs';
    const workspace = join(root, `dry-run-${dryRunId}`);
    await mkdir(workspace, { recursive: true });
    return workspace;
  }

  private async log(
    dryRunId: string,
    source: RunnerLogSource,
    message: string,
    secretContext: SecretExecutionContext,
  ) {
    await this.state.appendLog(
      dryRunId,
      source,
      this.masking.maskString(message, secretContext.masking),
    );
  }
}
