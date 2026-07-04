export type RunStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'CLAIMED'
  | 'PREPARING_WORKSPACE'
  | 'VALIDATING_ENVIRONMENT'
  | 'PULLING_IMAGES'
  | 'STARTING_ENVIRONMENT'
  | 'WAITING_FOR_HEALTHCHECK'
  | 'EXECUTING_TESTS'
  | 'COLLECTING_ARTIFACTS'
  | 'CLEANING_UP'
  | 'PASSED'
  | 'TEST_FAILED'
  | 'INFRA_FAILED'
  | 'TIMED_OUT'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED';
export type TestRunFailureCategory =
  | 'TEST_ASSERTION'
  | 'ENVIRONMENT_VALIDATION'
  | 'IMAGE_PULL'
  | 'CONTAINER_START'
  | 'HEALTHCHECK'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'INTERNAL';
export type TestResultStatus = 'PASSED' | 'FAILED';
export type SubscriptionTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type UserRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: UserRole;
  company?: Company;
}

export interface Company {
  id: string;
  name: string;
  plan: SubscriptionPlan;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  maxProjects: number;
  maxRunsPerMonth: number;
  maxConcurrentRuns: number;
  maxRunnerMinutes?: number;
  reportRetentionDays: number;
  usage?: Usage;
}

export interface CompanyUsage {
  projectsUsed: number;
  runsThisMonth: number;
  concurrentRuns: number;
}

export type Usage = CompanyUsage;

export interface CompanyProfile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  plan: SubscriptionPlan & {
    maxRunnerMinutes: number;
    usage: CompanyUsage;
  };
  membersCount: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  baseUrl: string;
  mainServiceName: string;
  healthcheckPath: string;
  healthcheckExpectedStatus: number;
  healthcheckTimeoutSeconds: number;
  lastRunStatus?: RunStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  baseUrl: string;
  mainServiceName: string;
  healthcheckPath: string;
  healthcheckExpectedStatus: number;
  healthcheckTimeoutSeconds: number;
}

export interface EnvironmentConfig {
  id?: string;
  projectId: string;
  dockerComposeYaml: string;
  backendTestYaml: string;
  visualConfig?: EnvironmentVisualConfig;
  mainServiceName: string;
  healthcheckPath: string;
  healthcheckExpectedStatus: number;
  healthcheckTimeoutSeconds: number;
  isValid?: boolean;
  updatedAt?: string;
}

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
  value: string;
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

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  yaml: string;
  visualFlow?: FlowSuiteDefinition;
  testsCount?: number;
  updatedAt: string;
}

export interface FlowSuiteDefinition {
  version: '1.0';
  suiteName: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowPosition {
  x: number;
  y: number;
}

export type FlowNode = FlowApiNode | FlowWaitNode | FlowPollUntilNode;

export type FlowNodeType = 'apiRequest' | 'wait' | 'pollUntil';

export type FlowAssertionOperator = 'equals' | 'contains' | 'exists';

export interface FlowAssertion {
  id?: string;
  fieldPath: string;
  operator: FlowAssertionOperator;
  expectedValue?: string;
}

export interface FlowBaseNode {
  id: string;
  position: FlowPosition;
  name: string;
  type?: FlowNodeType;
}

export interface FlowApiNode extends FlowBaseNode {
  type?: 'apiRequest';
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  jsonBody?: unknown;
  expectStatus?: number;
  jsonContains?: unknown;
  assertions?: FlowAssertion[];
  save?: Record<string, string>;
}

export interface FlowWaitNode extends FlowBaseNode {
  type: 'wait';
  durationMs: number;
}

export interface FlowPollUntilNode extends FlowBaseNode {
  type: 'pollUntil';
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  jsonBody?: unknown;
  expectStatus?: number;
  jsonContains?: unknown;
  assertions?: FlowAssertion[];
  save?: Record<string, string>;
  timeoutSeconds: number;
  intervalSeconds: number;
  failureMessage?: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface TestRun {
  id: string;
  projectId: string;
  status: RunStatus;
  statusReason?: string;
  failureCategory?: TestRunFailureCategory;
  currentPhase?: string;
  phaseTimestamps?: Record<string, string>;
  queuedAt?: string;
  enqueuedAt?: string;
  claimedAt?: string;
  cancellationRequestedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs?: number;
  results?: TestResult[];
}

export interface TestResult {
  id: string;
  stepId?: string;
  stepType?: FlowNodeType;
  status: TestResultStatus;
  suiteName: string;
  testName: string;
  method: string;
  path: string;
  expectedStatus: number;
  actualStatus?: number;
  attempts?: number;
  durationMs?: number;
  requestBody?: unknown;
  responseBody?: unknown;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
}

export interface RunnerLog {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface DashboardSummary {
  totalProjects: number;
  recentRuns: TestRun[];
  passed: number;
  failed: number;
  plan: SubscriptionPlan;
}

export interface TestRunEvent {
  type:
    | 'run.started'
    | 'environment.starting'
    | 'environment.ready'
    | 'test.started'
    | 'test.passed'
    | 'test.failed'
    | 'logs.updated'
    | 'environment.stopping'
    | 'run.finished';
  message: string;
  timestamp: string;
  payload?: unknown;
}
