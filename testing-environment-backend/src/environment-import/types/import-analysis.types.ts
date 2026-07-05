export type EnvironmentImportSource =
  'UPLOAD' | 'PASTE' | 'TEMPLATE' | 'RUNNING_ENVIRONMENT' | 'GIT_REPOSITORY';

export interface ComposePort {
  host?: string;
  container: string;
  protocol?: string;
}

export interface ComposeEnvironmentVariable {
  key: string;
  value?: string;
  isSensitive: boolean;
}

export interface ComposeVolume {
  source?: string;
  target: string;
  type: 'bind' | 'volume' | 'unknown';
}

export interface ComposeHealthcheck {
  test?: unknown;
  interval?: string;
  timeout?: string;
  retries?: number;
  startPeriod?: string;
}

export interface ComposeServiceAnalysis {
  name: string;
  image?: string;
  buildContext?: string;
  buildDockerfile?: string;
  ports: ComposePort[];
  dependencies: string[];
  environment: ComposeEnvironmentVariable[];
  volumes: ComposeVolume[];
  healthcheck?: ComposeHealthcheck;
}

export interface SecurityWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  serviceName?: string;
  message: string;
}

export interface ProbableMainService {
  serviceName: string;
  confidence: number;
  reasons: string[];
}

export interface ComposeAnalysisResult {
  source: EnvironmentImportSource;
  services: ComposeServiceAnalysis[];
  probableMainService?: ProbableMainService;
  probableBaseUrl?: string;
  securityWarnings: SecurityWarning[];
}
