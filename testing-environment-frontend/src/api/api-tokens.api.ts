import { generatedApi } from './generated-client';
import type {
  ApiTokenResponseDto,
  CreateApiTokenDto,
  CreateApiTokenResponseDto,
} from '../generated/api';

export type ApiToken = ApiTokenResponseDto;
export type CreateApiTokenInput = CreateApiTokenDto;
export type CreateApiTokenResult = CreateApiTokenResponseDto;

class ApiTokensApi {
  async list(): Promise<ApiToken[]> {
    return generatedApi.ApiTokensController_list({ path: {} });
  }

  async create(input: CreateApiTokenInput): Promise<CreateApiTokenResult> {
    return generatedApi.ApiTokensController_create({ path: {} }, input);
  }

  async revoke(tokenId: string): Promise<ApiToken> {
    return generatedApi.ApiTokensController_revoke({ path: { tokenId } });
  }
}

export const apiTokensApi = new ApiTokensApi();
