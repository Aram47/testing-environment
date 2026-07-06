import { GeneratedApiClient } from '../generated/api';
import { apiClient } from './client';

export const generatedApi = new GeneratedApiClient(apiClient);
