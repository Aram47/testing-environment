export type PreflightCheckStatus = 'pass' | 'warn' | 'fail';

export interface PreflightCheck {
  id: string;
  status: PreflightCheckStatus;
  message: string;
}

export interface EnvironmentResourceEstimation {
  tier: 'low' | 'medium' | 'high';
  serviceCount: number;
  notes: string[];
}

export interface EnvironmentPreflightResult {
  ok: boolean;
  checks: PreflightCheck[];
  securityErrors: string[];
  dependencyWarnings: string[];
  resourceEstimation: EnvironmentResourceEstimation;
}
