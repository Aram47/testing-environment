import { apiClient } from './client';
import type {
  EnvironmentConfig,
  EnvironmentConfigRevision,
  EnvironmentVisualConfig,
  RevisionLineDiff,
} from '../types';

interface EnvironmentConfigPayload {
  type: 'DOCKER_COMPOSE' | 'EXTERNAL_URL';
  composeYaml?: string;
  backendTestYaml?: string;
  visualConfig?: EnvironmentVisualConfig;
}

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
    const { data } = await apiClient.get<EnvironmentConfigResponse>(`/projects/${projectId}/environment-config`);
    return this.toEnvironmentConfig(data);
  }

  async create(projectId: string, input: Omit<EnvironmentConfig, 'projectId'>): Promise<EnvironmentConfig> {
    const { data } = await apiClient.post<EnvironmentConfigResponse>(`/projects/${projectId}/environment-config`, this.toPayload(input));
    return this.toEnvironmentConfig(data);
  }

  async update(projectId: string, input: Partial<EnvironmentConfig>): Promise<EnvironmentConfig> {
    const { data } = await apiClient.patch<EnvironmentConfigResponse>(`/projects/${projectId}/environment-config`, this.toPayload(input));
    return this.toEnvironmentConfig(data);
  }

  async compile(projectId: string, visualConfig: EnvironmentVisualConfig): Promise<EnvironmentCompileResult> {
    const { data } = await apiClient.post<EnvironmentCompileResult>(`/projects/${projectId}/environment-config/compile`, { visualConfig });
    return data;
  }

  async revisions(projectId: string): Promise<EnvironmentConfigRevision[]> {
    const { data } = await apiClient.get<EnvironmentConfigRevision[]>(`/projects/${projectId}/environment-config/revisions`);
    return data;
  }

  async publish(projectId: string, revisionId: string): Promise<EnvironmentConfig> {
    const { data } = await apiClient.post<EnvironmentConfigResponse>(`/projects/${projectId}/environment-config/revisions/${revisionId}/publish`);
    return this.toEnvironmentConfig(data);
  }

  async compare(projectId: string, from: string, to: string): Promise<EnvironmentRevisionCompareResult> {
    const { data } = await apiClient.get<EnvironmentRevisionCompareResult>(`/projects/${projectId}/environment-config/revisions/compare`, {
      params: { from, to },
    });
    return data;
  }

  private toPayload(input: Partial<EnvironmentConfig>): EnvironmentConfigPayload {
    if (input.visualConfig) {
      return {
        type: 'DOCKER_COMPOSE',
        visualConfig: input.visualConfig,
      };
    }

    return {
      type: 'DOCKER_COMPOSE',
      composeYaml: input.dockerComposeYaml ?? '',
      backendTestYaml: input.backendTestYaml ?? '',
    };
  }

  private toEnvironmentConfig(config: EnvironmentConfigResponse): EnvironmentConfig {
    return {
      ...config,
      dockerComposeYaml: config.dockerComposeYaml ?? config.composeYaml ?? '',
    };
  }
}

export const environmentConfigsApi = new EnvironmentConfigsApi();
