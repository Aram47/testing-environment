import type { SecretMetadata } from '../types';
import { generatedApi } from './generated-client';
import type { CreateSecretDto } from '../generated/api';

export interface CreateSecretInput {
  key: string;
  value: string;
}

class SecretsApi {
  async list(projectId: string): Promise<SecretMetadata[]> {
    return generatedApi.SecretsController_list({ path: { projectId } }) as Promise<SecretMetadata[]>;
  }

  async create(projectId: string, input: CreateSecretInput): Promise<SecretMetadata> {
    return generatedApi.SecretsController_create(
      { path: { projectId } },
      input as CreateSecretDto,
    ) as Promise<SecretMetadata>;
  }

  async delete(projectId: string, secretId: string): Promise<{ deleted: true }> {
    return generatedApi.SecretsController_delete({
      path: { projectId, secretId },
    }) as Promise<{ deleted: true }>;
  }
}

export const secretsApi = new SecretsApi();
