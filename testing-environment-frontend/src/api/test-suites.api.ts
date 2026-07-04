import { apiClient } from './client';
import type { FlowSuiteDefinition, RevisionLineDiff, TestSuite, TestSuiteRevision } from '../types';
import { PaginatedResultAdapter, type PaginatedResult } from './paginated-result';

export interface TestSuiteInput {
  name: string;
  yamlContent?: string;
  visualFlow?: FlowSuiteDefinition;
}

interface TestSuiteResponse extends Omit<TestSuite, 'yaml'> {
  yaml?: string;
  yamlContent?: string;
}

export interface FlowCompileResult {
  yamlContent: string;
  testsCount: number;
  warnings: string[];
}

export interface TestSuiteRevisionCompareResult {
  from: TestSuiteRevision;
  to: TestSuiteRevision;
  diffs: {
    compiledYaml: RevisionLineDiff[];
  };
}

class TestSuitesApi {
  async list(projectId: string): Promise<TestSuite[]> {
    const { data } = await apiClient.get<TestSuiteResponse[] | PaginatedResult<TestSuiteResponse>>(`/projects/${projectId}/test-suites`);
    return PaginatedResultAdapter.toItems(data).map((suite) => this.toTestSuite(suite));
  }

  async get(projectId: string, suiteId: string): Promise<TestSuite> {
    const { data } = await apiClient.get<TestSuiteResponse>(`/projects/${projectId}/test-suites/${suiteId}`);
    return this.toTestSuite(data);
  }

  async create(projectId: string, input: TestSuiteInput): Promise<TestSuite> {
    const { data } = await apiClient.post<TestSuiteResponse>(`/projects/${projectId}/test-suites`, input);
    return this.toTestSuite(data);
  }

  async update(projectId: string, suiteId: string, input: Partial<TestSuiteInput>): Promise<TestSuite> {
    const { data } = await apiClient.patch<TestSuiteResponse>(`/projects/${projectId}/test-suites/${suiteId}`, input);
    return this.toTestSuite(data);
  }

  async compileFlow(projectId: string, visualFlow: FlowSuiteDefinition): Promise<FlowCompileResult> {
    const { data } = await apiClient.post<FlowCompileResult>(`/projects/${projectId}/test-suites/compile-flow`, { visualFlow });
    return data;
  }

  async revisions(projectId: string, suiteId: string): Promise<TestSuiteRevision[]> {
    const { data } = await apiClient.get<TestSuiteRevision[]>(`/projects/${projectId}/test-suites/${suiteId}/revisions`);
    return data;
  }

  async publish(projectId: string, suiteId: string, revisionId: string): Promise<TestSuite> {
    const { data } = await apiClient.post<TestSuiteResponse>(`/projects/${projectId}/test-suites/${suiteId}/revisions/${revisionId}/publish`);
    return this.toTestSuite(data);
  }

  async compare(projectId: string, suiteId: string, from: string, to: string): Promise<TestSuiteRevisionCompareResult> {
    const { data } = await apiClient.get<TestSuiteRevisionCompareResult>(`/projects/${projectId}/test-suites/${suiteId}/revisions/compare`, {
      params: { from, to },
    });
    return data;
  }

  async remove(projectId: string, suiteId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/test-suites/${suiteId}`);
  }

  private toTestSuite(suite: TestSuiteResponse): TestSuite {
    return {
      ...suite,
      yaml: suite.yaml ?? suite.yamlContent ?? '',
    };
  }
}

export const testSuitesApi = new TestSuitesApi();
