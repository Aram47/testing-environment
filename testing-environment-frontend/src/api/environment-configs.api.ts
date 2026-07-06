import type {
  EnvironmentConfig,
  EnvironmentConfigRevision,
  EnvironmentVisualConfig,
  RevisionLineDiff,
} from '../types';
import { DEFAULT_LIST_LIMIT, PaginatedResultAdapter } from './paginated-result';
import { generatedApi } from './generated-client';
import type {
  CompileEnvironmentConfigDto,
  ComposeImportResultDto,
  EnvironmentDryRunResponseDto,
  EnvironmentPreflightResultDto,
  ImportComposeDto,
  PreflightEnvironmentConfigDto,
  UpsertEnvironmentConfigDto,
} from '../generated/api';

interface EnvironmentConfigResponse extends Omit<EnvironmentConfig, 'dockerComposeYaml'> {
  composeYaml?: string;
  dockerComposeYaml?: string;
}

export interface EnvironmentCompileResult {
  composeYaml: string;
  backendTestYaml: string;
  warnings: string[];
}

export interface EnvironmentRevisionCompareResult {
  from: EnvironmentConfigRevision;
  to: EnvironmentConfigRevision;
  diffs: {
    compiledComposeYaml: RevisionLineDiff[];
    compiledRuntimeYaml: RevisionLineDiff[];
  };
}

export interface EnvironmentSaveInput extends Partial<EnvironmentConfig> {
  baseRevisionId?: string;
}

export type PreflightCheckStatus = 'pass' | 'warn' | 'fail';

export interface PreflightCheck {
  id: string;
  status: PreflightCheckStatus;
  message: string;
}

export interface EnvironmentPreflightResult {
  ok: boolean;
  checks: PreflightCheck[];
  securityErrors: string[];
  dependencyWarnings: string[];
  resourceEstimation: {
    tier: 'low' | 'medium' | 'high';
    serviceCount: number;
    notes: string[];
  };
}

export interface ComposeImportResult {
  visualConfig: EnvironmentVisualConfig;
  analysis?: Record<string, unknown>;
  importWarnings: string[];
  unsupportedFields: string[];
}

export interface EnvironmentDryRun {
  id: string;
  projectId: string;
  environmentConfigRevisionId: string;
  status: string;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
  environmentConfigRevision?: EnvironmentConfigRevision;
  logs?: Array<{ id: string; source: string; message: string; createdAt: string }>;
}

class EnvironmentConfigsApi {
  async get(projectId: string): Promise<EnvironmentConfig> {
    const data = await generatedApi.EnvironmentConfigsController_find({
      path: { projectId },
    }) as EnvironmentConfigResponse;
    return this.toEnvironmentConfig(data);
  }

  async create(projectId: string, input: Omit<EnvironmentConfig, 'projectId'>): Promise<EnvironmentConfig> {
    const data = await generatedApi.EnvironmentConfigsController_create(
      { path: { projectId } },
      this.toPayload(input) as UpsertEnvironmentConfigDto,
    ) as EnvironmentConfigResponse;
    return this.toEnvironmentConfig(data);
  }

  async update(projectId: string, input: EnvironmentSaveInput): Promise<EnvironmentConfig> {
    const data = await generatedApi.EnvironmentConfigsController_update(
      { path: { projectId } },
      this.toPayload(input) as UpsertEnvironmentConfigDto,
    ) as EnvironmentConfigResponse;
    return this.toEnvironmentConfig(data);
  }

  async compile(projectId: string, visualConfig: EnvironmentVisualConfig): Promise<EnvironmentCompileResult> {
    return generatedApi.EnvironmentConfigsController_compile(
      { path: { projectId } },
      { visualConfig } as unknown as CompileEnvironmentConfigDto,
    ) as Promise<EnvironmentCompileResult>;
  }

  async preflight(
    projectId: string,
    payload: {
      visualConfig?: EnvironmentVisualConfig;
      composeYaml?: string;
      backendTestYaml?: string;
      revisionId?: string;
    },
  ): Promise<EnvironmentPreflightResult> {
    const data = await generatedApi.EnvironmentConfigsController_runPreflight(
      { path: { projectId } },
      payload as PreflightEnvironmentConfigDto,
    );
    return data as EnvironmentPreflightResultDto as EnvironmentPreflightResult;
  }

  async importCompose(
    projectId: string,
    payload: { composeYaml: string; source: 'paste' | 'upload' },
  ): Promise<ComposeImportResult> {
    const data = await generatedApi.EnvironmentConfigsController_importCompose(
      { path: { projectId } },
      payload as ImportComposeDto,
    );
    return this.toComposeImportResult(data);
  }

  async revisions(projectId: string): Promise<EnvironmentConfigRevision[]> {
    return generatedApi.EnvironmentConfigsController_revisions({
      path: { projectId },
    }) as Promise<EnvironmentConfigRevision[]>;
  }

  async getRevision(projectId: string, revisionId: string): Promise<EnvironmentConfigRevision> {
    return generatedApi.EnvironmentConfigsController_getRevision({
      path: { projectId, revisionId },
    }) as Promise<EnvironmentConfigRevision>;
  }

  async publish(projectId: string, revisionId: string): Promise<EnvironmentConfig> {
    const data = await generatedApi.EnvironmentConfigsController_publishRevision({
      path: { projectId, revisionId },
    }) as EnvironmentConfigResponse;
    return this.toEnvironmentConfig(data);
  }

  async compare(projectId: string, from: string, to: string): Promise<EnvironmentRevisionCompareResult> {
    return generatedApi.EnvironmentConfigsController_compareRevisions({
      path: { projectId },
      query: { from, to },
    }) as Promise<EnvironmentRevisionCompareResult>;
  }

  async createDryRun(projectId: string, revisionId: string): Promise<EnvironmentDryRun> {
    const data = await generatedApi.EnvironmentConfigsController_createDryRun(
      { path: { projectId } },
      { revisionId },
    );
    return this.toDryRun(data);
  }

  async listDryRuns(projectId: string): Promise<EnvironmentDryRun[]> {
    const data = await generatedApi.EnvironmentConfigsController_listDryRuns({
      path: { projectId },
      query: { page: 1, limit: DEFAULT_LIST_LIMIT },
    });
    return PaginatedResultAdapter.toItems(data).map((dryRun) => this.toDryRun(dryRun));
  }

  async getDryRun(projectId: string, dryRunId: string): Promise<EnvironmentDryRun> {
    const data = await generatedApi.EnvironmentConfigsController_getDryRun({
      path: { projectId, dryRunId },
    });
    return this.toDryRun(data);
  }

  async cancelDryRun(projectId: string, dryRunId: string): Promise<EnvironmentDryRun> {
    const data = await generatedApi.EnvironmentConfigsController_cancelDryRun({
      path: { projectId, dryRunId },
    });
    return this.toDryRun(data);
  }

  private toComposeImportResult(data: ComposeImportResultDto): ComposeImportResult {
    return {
      visualConfig: data.visualConfig as unknown as EnvironmentVisualConfig,
      analysis: data.analysis,
      importWarnings: data.importWarnings,
      unsupportedFields: data.unsupportedFields,
    };
  }

  private toDryRun(data: EnvironmentDryRunResponseDto): EnvironmentDryRun {
    return {
      id: data.id,
      projectId: data.projectId,
      environmentConfigRevisionId: data.environmentConfigRevisionId,
      status: data.status,
      errorMessage: data.errorMessage ?? undefined,
      startedAt: data.startedAt ?? undefined,
      finishedAt: data.finishedAt ?? undefined,
      environmentConfigRevision: data.environmentConfigRevision as EnvironmentConfigRevision | undefined,
      logs: data.logs?.map((log) => ({
        id: log.id,
        source: log.source,
        message: log.message,
        createdAt: log.createdAt,
      })),
    };
  }

  private toPayload(input: EnvironmentSaveInput): UpsertEnvironmentConfigDto {
    if (input.visualConfig) {
      return {
        type: 'DOCKER_COMPOSE',
        visualConfig: input.visualConfig,
        baseRevisionId: input.baseRevisionId,
      } as unknown as UpsertEnvironmentConfigDto;
    }

    return {
      type: 'DOCKER_COMPOSE',
      composeYaml: input.dockerComposeYaml ?? '',
      backendTestYaml: input.backendTestYaml ?? '',
      baseRevisionId: input.baseRevisionId,
    } as UpsertEnvironmentConfigDto;
  }

  private toEnvironmentConfig(config: EnvironmentConfigResponse): EnvironmentConfig {
    return {
      ...config,
      dockerComposeYaml: config.dockerComposeYaml ?? config.composeYaml ?? '',
    };
  }
}

export const environmentConfigsApi = new EnvironmentConfigsApi();
