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
import { generatedApi } from './generated-client';
import type { AnalyzeComposeDto, ConfirmOnboardingDto, UpdateOnboardingSessionDto } from '../generated/api';

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
    return generatedApi.OnboardingController_session({ path: {} }) as Promise<OnboardingSession>;
  }

  async updateSession(input: {
    currentStep?: OnboardingStep;
    draftData?: OnboardingDraftData;
  }): Promise<OnboardingSession> {
    return generatedApi.OnboardingController_updateSession(
      { path: {} },
      input as UpdateOnboardingSessionDto,
    ) as Promise<OnboardingSession>;
  }

  async analyzeCompose(input: {
    source: Extract<EnvironmentImportSource, 'UPLOAD' | 'PASTE' | 'TEMPLATE'>;
    composeYaml: string;
  }): Promise<ComposeAnalysisResult> {
    return generatedApi.OnboardingController_analyzeCompose(
      { path: {} },
      input as AnalyzeComposeDto,
    ) as Promise<ComposeAnalysisResult>;
  }

  async templates(): Promise<OnboardingTemplate[]> {
    return generatedApi.OnboardingController_templates({ path: {} }) as Promise<OnboardingTemplate[]>;
  }

  async confirm(input: ConfirmOnboardingInput): Promise<ConfirmOnboardingResult> {
    return generatedApi.OnboardingController_confirm(
      { path: {} },
      input as ConfirmOnboardingDto,
    ) as Promise<ConfirmOnboardingResult>;
  }

  async createDemoProject(): Promise<ConfirmOnboardingResult> {
    return generatedApi.OnboardingController_demoProject({ path: {} }) as Promise<ConfirmOnboardingResult>;
  }
}

export const onboardingApi = new OnboardingApi();
