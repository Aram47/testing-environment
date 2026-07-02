import { apiClient } from './client';
import type { EnvironmentConfig } from '../types';

interface EnvironmentConfigPayload {
  type: 'DOCKER_COMPOSE';
  composeYaml: string;
  backendTestYaml: string;
}

class EnvironmentConfigsApi {
  async get(projectId: string): Promise<EnvironmentConfig> {
    const { data } = await apiClient.get<EnvironmentConfig>(`/projects/${projectId}/environment-config`);
    return data;
  }

  async create(projectId: string, input: Omit<EnvironmentConfig, 'projectId'>): Promise<EnvironmentConfig> {
    const payload: EnvironmentConfigPayload = {
      type: 'DOCKER_COMPOSE',
      composeYaml: input.dockerComposeYaml,
      backendTestYaml: input.backendTestYaml,
    };
    const { data } = await apiClient.post<EnvironmentConfig>(`/projects/${projectId}/environment-config`, payload);
    return data;
  }

  async update(projectId: string, input: Partial<EnvironmentConfig>): Promise<EnvironmentConfig> {
    const payload: EnvironmentConfigPayload = {
      type: 'DOCKER_COMPOSE',
      composeYaml: input.dockerComposeYaml ?? '',
      backendTestYaml: input.backendTestYaml ?? '',
    };
    const { data } = await apiClient.patch<EnvironmentConfig>(`/projects/${projectId}/environment-config`, payload);
    return data;
  }
}

export const environmentConfigsApi = new EnvironmentConfigsApi();
