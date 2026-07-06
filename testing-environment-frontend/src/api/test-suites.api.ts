import type {
  ApiImportSourceType,
  ApiImportTemplate,
  FlowSuiteDefinition,
  ImportGenerateResult,
  ImportPreviewResult,
  ImportedApiOperation,
  ManualImportRequest,
  RevisionLineDiff,
  TestSuite,
  TestSuiteRevision,
  TestSuiteSourceMode,
} from '../types';
import { PaginatedResultAdapter, DEFAULT_LIST_LIMIT, type PaginatedResult } from './paginated-result';
import { generatedApi } from './generated-client';
import type {
  CompileFlowDto,
  CreateTestSuiteDto,
  GenerateImportedFlowDto,
  ImportPreviewDto,
  UpdateTestSuiteDto,
} from '../generated/api';

export interface TestSuiteInput {
  name: string;
  sourceMode?: TestSuiteSourceMode;
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
  executionPlan?: unknown;
}

export interface ImportPreviewInput {
  sourceType: ApiImportSourceType;
  content?: string;
  files?: Record<string, string>;
  manualRequest?: ManualImportRequest;
}

export interface GenerateImportedFlowInput {
  suiteName: string;
  template: ApiImportTemplate;
  operations: ImportedApiOperation[];
  acknowledgeDestructive?: boolean;
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
    const data = await generatedApi.TestSuitesController_list({
      path: { projectId },
      query: { page: 1, limit: DEFAULT_LIST_LIMIT },
    }) as TestSuiteResponse[] | PaginatedResult<TestSuiteResponse>;
    return PaginatedResultAdapter.toItems(data).map((suite) => this.toTestSuite(suite));
  }

  async get(projectId: string, suiteId: string): Promise<TestSuite> {
    const data = await generatedApi.TestSuitesController_find({
      path: { projectId, suiteId },
    }) as TestSuiteResponse;
    return this.toTestSuite(data);
  }

  async create(projectId: string, input: TestSuiteInput): Promise<TestSuite> {
    const data = await generatedApi.TestSuitesController_create(
      { path: { projectId } },
      input as CreateTestSuiteDto,
    ) as TestSuiteResponse;
    return this.toTestSuite(data);
  }

  async update(projectId: string, suiteId: string, input: Partial<TestSuiteInput>): Promise<TestSuite> {
    const data = await generatedApi.TestSuitesController_update(
      { path: { projectId, suiteId } },
      input as UpdateTestSuiteDto,
    ) as TestSuiteResponse;
    return this.toTestSuite(data);
  }

  async compileFlow(projectId: string, visualFlow: FlowSuiteDefinition): Promise<FlowCompileResult> {
    return generatedApi.TestSuitesController_compileFlow(
      { path: { projectId } },
      { visualFlow } as unknown as CompileFlowDto,
    ) as Promise<FlowCompileResult>;
  }

  async previewImport(projectId: string, input: ImportPreviewInput): Promise<ImportPreviewResult> {
    return generatedApi.TestSuitesController_previewImport(
      { path: { projectId } },
      input as ImportPreviewDto,
    ) as Promise<ImportPreviewResult>;
  }

  async generateImportedFlow(projectId: string, input: GenerateImportedFlowInput): Promise<ImportGenerateResult> {
    return generatedApi.TestSuitesController_generateImportedFlow(
      { path: { projectId } },
      input as unknown as GenerateImportedFlowDto,
    ) as Promise<ImportGenerateResult>;
  }

  async revisions(projectId: string, suiteId: string): Promise<TestSuiteRevision[]> {
    return generatedApi.TestSuitesController_revisions({
      path: { projectId, suiteId },
    }) as Promise<TestSuiteRevision[]>;
  }

  async publish(projectId: string, suiteId: string, revisionId: string): Promise<TestSuite> {
    const data = await generatedApi.TestSuitesController_publishRevision({
      path: { projectId, suiteId, revisionId },
    }) as TestSuiteResponse;
    return this.toTestSuite(data);
  }

  async compare(projectId: string, suiteId: string, from: string, to: string): Promise<TestSuiteRevisionCompareResult> {
    return generatedApi.TestSuitesController_compareRevisions({
      path: { projectId, suiteId },
      query: { from, to },
    }) as Promise<TestSuiteRevisionCompareResult>;
  }

  async remove(projectId: string, suiteId: string): Promise<void> {
    await generatedApi.TestSuitesController_delete({ path: { projectId, suiteId } });
  }

  private toTestSuite(suite: TestSuiteResponse): TestSuite {
    return {
      ...suite,
      yaml: suite.yaml ?? suite.yamlContent ?? '',
    };
  }
}

export const testSuitesApi = new TestSuitesApi();
