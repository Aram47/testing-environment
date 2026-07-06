import type {
  EnvironmentConfig,
  EnvironmentConfigRevision,
  EnvironmentVisualConfig,
  RevisionLineDiff,
} from '../types';
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

  async update(projectId: string, input: Partial<EnvironmentConfig>): Promise<EnvironmentConfig> {
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

  async revisions(projectId: string): Promise<EnvironmentConfigRevision[]> {
    return generatedApi.EnvironmentConfigsController_revisions({
      path: { projectId },
    }) as Promise<EnvironmentConfigRevision[]>;
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

  private toPayload(input: Partial<EnvironmentConfig>): UpsertEnvironmentConfigDto {
    if (input.visualConfig) {
      return {
        type: 'DOCKER_COMPOSE',
        visualConfig: input.visualConfig,
      } as unknown as UpsertEnvironmentConfigDto;
    }

    return {
      type: 'DOCKER_COMPOSE',
      composeYaml: input.dockerComposeYaml ?? '',
      backendTestYaml: input.backendTestYaml ?? '',
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
