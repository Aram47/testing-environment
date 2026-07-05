import { apiClient } from './client';
import type {
  ComposeAnalysisResult,
  EnvironmentConfigType,
  EnvironmentImportSource,
  OnboardingDraftData,
  OnboardingProjectDraft,
  OnboardingSession,
  OnboardingStep,
  OnboardingTemplate,
  Project,
} from '../types';

export interface ConfirmOnboardingInput {
  project: OnboardingProjectDraft;
  environmentType: EnvironmentConfigType;
  composeYaml?: string;
  backendTestYaml: string;
  analysis?: ComposeAnalysisResult;
  templateId?: string;
}

export interface ConfirmOnboardingResult {
  project: Project;
  session: OnboardingSession;
}

class OnboardingApi {
  async session(): Promise<OnboardingSession> {
    const { data } = await apiClient.get<OnboardingSession>('/onboarding/session');
    return data;
  }

  async updateSession(input: {
    currentStep?: OnboardingStep;
    draftData?: OnboardingDraftData;
  }): Promise<OnboardingSession> {
    const { data } = await apiClient.patch<OnboardingSession>('/onboarding/session', input);
    return data;
  }

  async analyzeCompose(input: {
    source: Extract<EnvironmentImportSource, 'UPLOAD' | 'PASTE' | 'TEMPLATE'>;
    composeYaml: string;
  }): Promise<ComposeAnalysisResult> {
    const { data } = await apiClient.post<ComposeAnalysisResult>('/onboarding/analyze-compose', input);
    return data;
  }

  async templates(): Promise<OnboardingTemplate[]> {
    const { data } = await apiClient.get<OnboardingTemplate[]>('/onboarding/templates');
    return data;
  }

  async confirm(input: ConfirmOnboardingInput): Promise<ConfirmOnboardingResult> {
    const { data } = await apiClient.post<ConfirmOnboardingResult>('/onboarding/confirm', input);
    return data;
  }

  async createDemoProject(): Promise<ConfirmOnboardingResult> {
    const { data } = await apiClient.post<ConfirmOnboardingResult>('/onboarding/demo-project');
    return data;
  }
}

export const onboardingApi = new OnboardingApi();
