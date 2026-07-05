import { apiClient } from './client';
import type { SecretMetadata } from '../types';

export interface CreateSecretInput {
  key: string;
  value: string;
}

class SecretsApi {
  async list(projectId: string): Promise<SecretMetadata[]> {
    const { data } = await apiClient.get<SecretMetadata[]>(`/projects/${projectId}/secrets`);
    return data;
  }

  async create(projectId: string, input: CreateSecretInput): Promise<SecretMetadata> {
    const { data } = await apiClient.post<SecretMetadata>(`/projects/${projectId}/secrets`, input);
    return data;
  }

  async delete(projectId: string, secretId: string): Promise<{ deleted: true }> {
    const { data } = await apiClient.delete<{ deleted: true }>(
      `/projects/${projectId}/secrets/${secretId}`,
    );
    return data;
  }
}

export const secretsApi = new SecretsApi();
