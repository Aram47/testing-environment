import { apiClient } from './client';
import type { EnvironmentConfig, EnvironmentVisualConfig } from '../types';

interface EnvironmentConfigPayload {
  type: 'DOCKER_COMPOSE';
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
