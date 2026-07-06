import type { CompanyProfile } from '../types';
import { generatedApi } from './generated-client';
import type { UpdateCompanyDto } from '../generated/api';

export interface UpdateCompanyInput {
  name: string;
}

class CompaniesApi {
  async me(): Promise<CompanyProfile> {
    return generatedApi.CompaniesController_me({ path: {} }) as Promise<CompanyProfile>;
  }

  async updateMe(input: UpdateCompanyInput): Promise<CompanyProfile> {
    return generatedApi.CompaniesController_updateMe({ path: {} }, input as UpdateCompanyDto) as Promise<CompanyProfile>;
  }
}

export const companiesApi = new CompaniesApi();
