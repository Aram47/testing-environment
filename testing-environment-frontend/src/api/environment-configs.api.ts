import type {
  EnvironmentConfig,
  EnvironmentConfigRevision,
  EnvironmentVisualConfig,
  RevisionLineDiff,
} from '../types';
import { apiClient } from './client';
import { generatedApi } from './generated-client';
import type { CompileEnvironmentConfigDto, UpsertEnvironmentConfigDto } from '../generated/api';

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
  private base(projectId: string) {
    return `/projects/${projectId}/environment-config`;
  }

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
    const { data } = await apiClient.post<EnvironmentPreflightResult>(
      `${this.base(projectId)}/preflight`,
      payload,
    );
    return data;
  }

  async importCompose(
    projectId: string,
    payload: { composeYaml: string; source: 'paste' | 'upload' },
  ): Promise<ComposeImportResult> {
    const { data } = await apiClient.post<ComposeImportResult>(
      `${this.base(projectId)}/import-compose`,
      payload,
    );
    return data;
  }

  async revisions(projectId: string): Promise<EnvironmentConfigRevision[]> {
    return generatedApi.EnvironmentConfigsController_revisions({
      path: { projectId },
    }) as Promise<EnvironmentConfigRevision[]>;
  }

  async getRevision(projectId: string, revisionId: string): Promise<EnvironmentConfigRevision> {
    const { data } = await apiClient.get<EnvironmentConfigRevision>(
      `${this.base(projectId)}/revisions/${revisionId}`,
    );
    return data;
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
    const { data } = await apiClient.post<EnvironmentDryRun>(`${this.base(projectId)}/dry-runs`, {
      revisionId,
    });
    return data;
  }

  async listDryRuns(projectId: string): Promise<EnvironmentDryRun[]> {
    const response = await apiClient.get<{ data: EnvironmentDryRun[] }>(
      `${this.base(projectId)}/dry-runs`,
    );
    return response.data.data;
  }

  async getDryRun(projectId: string, dryRunId: string): Promise<EnvironmentDryRun> {
    const { data } = await apiClient.get<EnvironmentDryRun>(
      `${this.base(projectId)}/dry-runs/${dryRunId}`,
    );
    return data;
  }

  async cancelDryRun(projectId: string, dryRunId: string): Promise<EnvironmentDryRun> {
    const { data } = await apiClient.post<EnvironmentDryRun>(
      `${this.base(projectId)}/dry-runs/${dryRunId}/cancel`,
    );
    return data;
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
