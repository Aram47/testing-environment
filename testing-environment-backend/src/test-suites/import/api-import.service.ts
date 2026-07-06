import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { ExecutionPlanCompilerService } from '../execution-plan-compiler.service';
import {
  ApiImportTemplate,
  ImportGenerateResult,
  ImportParseInput,
  ImportPreviewResult,
} from '../types/api-import.types';
import { ImportFlowFactory } from './import-flow.factory';
import { ImportWarningService } from './import-warning.service';
import { BrunoImportParser } from './parsers/bruno-import.parser';
import { CurlImportParser } from './parsers/curl-import.parser';
import { ManualRequestImportParser } from './parsers/manual-request-import.parser';
import { OpenApiImportParser } from './parsers/openapi-import.parser';
import { PostmanImportParser } from './parsers/postman-import.parser';

const IMPORT_TEMPLATES: ApiImportTemplate[] = [
  'SMOKE_TEST',
  'AUTHENTICATED_JOURNEY',
  'CRUD_LIFECYCLE',
  'ASYNC_POLLING',
  'READINESS_TEST',
];
const MAX_IMPORT_CONTENT_CHARS = 1024 * 1024;

@Injectable()
export class ApiImportService {
  constructor(
    private readonly projectAccess: ProjectAccessService,
    private readonly warnings: ImportWarningService,
    private readonly openApiParser: OpenApiImportParser,
    private readonly postmanParser: PostmanImportParser,
    private readonly brunoParser: BrunoImportParser,
    private readonly curlParser: CurlImportParser,
    private readonly manualParser: ManualRequestImportParser,
    private readonly flowFactory: ImportFlowFactory,
    private readonly compiler: ExecutionPlanCompilerService,
  ) {}

  async preview(
    projectId: string,
    companyId: string,
    input: ImportParseInput,
  ): Promise<ImportPreviewResult> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const normalizedInput = this.normalizeInput(input);
    const result = this.parserFor(normalizedInput.sourceType).parse(normalizedInput);
    const authSchemes = this.warnings.mergeAuthSchemes(result.authSchemes);
    return {
      ...result,
      authSchemes,
      warnings: result.warnings,
      templates: IMPORT_TEMPLATES,
      suggestedSecrets: this.warnings.suggestedSecrets(authSchemes),
    };
  }

  async generateFlow(
    projectId: string,
    companyId: string,
    input: {
      suiteName: string;
      template: ApiImportTemplate;
      operations: ImportPreviewResult['operations'];
      acknowledgeDestructive?: boolean;
    },
  ): Promise<ImportGenerateResult> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const { flow, warnings } = this.flowFactory.create(
      input.suiteName,
      input.template,
      input.operations,
      input.acknowledgeDestructive === true,
    );
    const compiled = this.compiler.compileVisual(flow);
    const authSchemes = this.warnings.mergeAuthSchemes(
      input.operations.flatMap(
        (operation) => this.warnings.sanitizeOperation(operation).authSchemes,
      ),
    );
    return {
      visualFlow: flow,
      yamlContent: compiled.yamlContent,
      testsCount: compiled.testsCount,
      warnings: [
        ...warnings,
        ...compiled.warnings.map((message) => ({
          code: 'FLOW_COMPILE_WARNING',
          severity: 'warning' as const,
          message,
        })),
      ],
      suggestedSecrets: this.warnings.suggestedSecrets(authSchemes),
    };
  }

  private parserFor(sourceType: ImportParseInput['sourceType']) {
    switch (sourceType) {
      case 'OPENAPI':
        return this.openApiParser;
      case 'POSTMAN':
        return this.postmanParser;
      case 'BRUNO':
        return this.brunoParser;
      case 'CURL':
        return this.curlParser;
      case 'MANUAL':
        return this.manualParser;
      default:
        throw new BadRequestException('Unsupported API import source type');
    }
  }

  private normalizeInput(input: ImportParseInput): ImportParseInput {
    const totalSize =
      (input.content?.length ?? 0) +
      Object.values(input.files ?? {}).reduce((sum, content) => sum + content.length, 0);
    if (totalSize > MAX_IMPORT_CONTENT_CHARS) {
      throw new BadRequestException('API import content exceeds the 1 MiB limit');
    }

    if (
      input.sourceType !== 'BRUNO' &&
      input.sourceType !== 'MANUAL' &&
      !input.content?.trim() &&
      input.files
    ) {
      const firstFileContent = Object.values(input.files)[0];
      return { ...input, content: firstFileContent };
    }

    return input;
  }
}
