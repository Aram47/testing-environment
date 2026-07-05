export interface ExecutionContextData {
  requestId?: string;
  companyId?: string;
  projectId?: string;
  runId?: string;
  runnerId?: string;
  jobId?: string;
  stepId?: string;
}

export interface TestRunJobContext extends ExecutionContextData {
  requestId: string;
  runId: string;
}
