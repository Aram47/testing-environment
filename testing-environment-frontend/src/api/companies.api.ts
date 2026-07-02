import type { CompanyProfile } from '../types';
import { apiClient } from './client';

export interface UpdateCompanyInput {
  name: string;
}

class CompaniesApi {
  async me(): Promise<CompanyProfile> {
    const { data } = await apiClient.get<CompanyProfile>('/companies/me');
    return data;
  }

  async updateMe(input: UpdateCompanyInput): Promise<CompanyProfile> {
    const { data } = await apiClient.patch<CompanyProfile>('/companies/me', input);
    return data;
  }
}

export const companiesApi = new CompaniesApi();
