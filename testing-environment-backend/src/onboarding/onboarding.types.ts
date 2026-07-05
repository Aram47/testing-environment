import { EnvironmentConfigType } from '@prisma/client';
import { ComposeAnalysisResult } from '../environment-import/types/import-analysis.types';

export type OnboardingStep = 'project' | 'environment' | 'api-import' | 'template' | 'run';

export interface OnboardingProjectDraft {
  name: string;
  description?: string;
  baseUrl: string;
  mainServiceName: string;
  healthcheckPath: string;
  healthcheckExpectedStatus: number;
  healthcheckTimeoutSeconds: number;
}

export interface OnboardingConfirmInput {
  project: OnboardingProjectDraft;
  environmentType: EnvironmentConfigType;
  composeYaml?: string;
  backendTestYaml?: string;
  analysis?: ComposeAnalysisResult;
  templateId?: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  environmentType: EnvironmentConfigType;
  project: OnboardingProjectDraft;
  composeYaml?: string;
  backendTestYaml: string;
}
