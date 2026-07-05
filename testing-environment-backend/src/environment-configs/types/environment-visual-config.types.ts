export interface EnvironmentVisualConfig {
  version: '1.0';
  services: EnvironmentServiceConfig[];
  app: EnvironmentAppConfig;
  run: EnvironmentRunConfig;
}

export interface EnvironmentServiceConfig {
  name: string;
  image?: string;
  buildContext?: string;
  buildDockerfile?: string;
  ports?: EnvironmentPortMapping[];
  environment?: EnvironmentVariable[];
  dependsOn?: string[];
  command?: string;
}

export interface EnvironmentPortMapping {
  host: string;
  container: string;
}

export interface EnvironmentVariable {
  key: string;
  value?: string;
  valueType?: 'literal' | 'secret' | 'runtime';
  secretKey?: string;
  variableName?: string;
}

export interface EnvironmentAppConfig {
  mainServiceName: string;
  baseUrl: string;
  healthcheckPath: string;
  healthcheckExpectedStatus: number;
  healthcheckTimeoutSeconds: number;
}

export interface EnvironmentRunConfig {
  timeoutMinutes: number;
  cleanup: boolean;
}

export interface EnvironmentCompileResult {
  composeYaml: string;
  backendTestYaml: string;
  warnings: string[];
}
