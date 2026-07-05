import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { ExecutionPlanCompilerService } from '../execution-plan-compiler.service';
import { VisualDslMigratorService } from '../visual-dsl-migrator.service';
import { YamlSuiteAdapterService } from '../yaml-suite-adapter.service';
import { ApiImportService } from './api-import.service';
import { ImportFlowFactory } from './import-flow.factory';
import { ImportWarningService } from './import-warning.service';
import { BrunoImportParser } from './parsers/bruno-import.parser';
import { CurlImportParser } from './parsers/curl-import.parser';
import { ManualRequestImportParser } from './parsers/manual-request-import.parser';
import { OpenApiImportParser } from './parsers/openapi-import.parser';
import { PostmanImportParser } from './parsers/postman-import.parser';

describe('ApiImportService', () => {
  const projectId = 'project-1';
  const companyId = 'company-1';
  const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
  let service: ApiImportService;
  let projectAccess: { getProjectOrThrow: jest.Mock };

  beforeEach(() => {
    const warnings = new ImportWarningService();
    projectAccess = { getProjectOrThrow: jest.fn(() => Promise.resolve({ id: projectId })) };
    service = new ApiImportService(
      projectAccess as unknown as ProjectAccessService,
      warnings,
      new OpenApiImportParser(warnings),
      new PostmanImportParser(warnings),
      new BrunoImportParser(warnings),
      new CurlImportParser(warnings),
      new ManualRequestImportParser(warnings),
      new ImportFlowFactory(warnings),
      new ExecutionPlanCompilerService(
        new VisualDslMigratorService(),
        new YamlSuiteAdapterService(),
      ),
    );
  });

  it('imports OpenAPI YAML with examples, responses, destructive warnings, and auth schemes', async () => {
    const result = await service.preview(projectId, companyId, {
      sourceType: 'OPENAPI',
      content: fixture('openapi.petstore.yaml'),
    });

    expect(projectAccess.getProjectOrThrow).toHaveBeenCalledWith(projectId, companyId);
    expect(result.operations.map((operation) => operation.id)).toEqual(
      expect.arrayContaining(['getHealth', 'listPets', 'createPet', 'deletePet']),
    );
    expect(result.operations.find((operation) => operation.id === 'createPet')?.body).toEqual({
      name: 'Nori',
      type: 'cat',
    });
    expect(
      result.operations.find((operation) => operation.id === 'deletePet')?.headers['X-API-Key'],
    ).toBe('{{ secret.API_KEY }}');
    expect(result.authSchemes.map((scheme) => scheme.type)).toEqual(
      expect.arrayContaining(['BEARER', 'API_KEY', 'BASIC', 'OAUTH']),
    );
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['DESTRUCTIVE_OPERATION', 'LITERAL_CREDENTIAL_REPLACED']),
    );
  });

  it('imports OpenAPI JSON body examples', async () => {
    const result = await service.preview(projectId, companyId, {
      sourceType: 'OPENAPI',
      content: fixture('openapi.petstore.json'),
    });

    expect(result.operations[0]).toMatchObject({
      id: 'createPetJson',
      body: { name: 'Mika', type: 'dog' },
    });
  });

  it('imports nested Postman v2.1 collection and replaces auth with secrets', async () => {
    const result = await service.preview(projectId, companyId, {
      sourceType: 'POSTMAN',
      content: fixture('postman.collection.v2.1.json'),
    });

    expect(result.operations).toHaveLength(2);
    expect(result.operations[0].name).toBe('Pets / List pets');
    expect(result.operations[0].headers.Authorization).toBe('Bearer {{ secret.API_TOKEN }}');
    expect(result.operations[1].body).toEqual({ name: 'Nori' });
    expect(result.suggestedSecrets).toContain('API_TOKEN');
  });

  it('imports Bruno .bru and OpenCollection YAML without executing scripts', async () => {
    const result = await service.preview(projectId, companyId, {
      sourceType: 'BRUNO',
      files: {
        'bruno-get-pet.bru': fixture('bruno-get-pet.bru'),
        'bruno-opencollection.yaml': fixture('bruno-opencollection.yaml'),
      },
    });

    expect(result.operations.map((operation) => operation.name)).toEqual(
      expect.arrayContaining([
        'Get pet',
        'Create pet from Bruno YAML',
        'Readiness from Bruno YAML',
      ]),
    );
    expect(
      result.operations.find((operation) => operation.name === 'Get pet')?.headers.Authorization,
    ).toBe('Bearer {{ secret.API_TOKEN }}');
    expect(result.warnings.map((warning) => warning.code)).toContain(
      'EXECUTABLE_IMPORT_CONTENT_IGNORED',
    );
  });

  it('safely parses cURL commands and rejects shell operators', async () => {
    const [postCommand, getCommand, unsafeCommand] = fixture('curl-commands.txt')
      .trim()
      .split('\n');
    const postResult = await service.preview(projectId, companyId, {
      sourceType: 'CURL',
      content: postCommand,
    });
    const getResult = await service.preview(projectId, companyId, {
      sourceType: 'CURL',
      content: getCommand,
    });

    expect(postResult.operations[0]).toMatchObject({
      method: 'POST',
      path: '/pets',
      headers: {
        Authorization: 'Bearer {{ secret.API_TOKEN }}',
        'Content-Type': 'application/json',
      },
      body: { name: 'Curl' },
    });
    expect(getResult.operations[0].headers['X-API-Key']).toBe('{{ secret.API_KEY }}');
    await expect(
      service.preview(projectId, companyId, { sourceType: 'CURL', content: unsafeCommand }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('imports manual request and generates flow only after destructive acknowledgement', async () => {
    const preview = await service.preview(projectId, companyId, {
      sourceType: 'MANUAL',
      manualRequest: {
        name: 'Create manual pet',
        method: 'POST',
        path: '/pets',
        headers: { Authorization: 'Bearer literal' },
        body: { name: 'Manual' },
        expectedStatus: 201,
      },
    });

    await expect(
      service.generateFlow(projectId, companyId, {
        suiteName: 'Imported',
        template: 'CRUD_LIFECYCLE',
        operations: preview.operations,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const generated = await service.generateFlow(projectId, companyId, {
      suiteName: 'Imported',
      template: 'CRUD_LIFECYCLE',
      operations: preview.operations,
      acknowledgeDestructive: true,
    });

    expect(generated.visualFlow.nodes[0]).toMatchObject({
      name: 'Create manual pet',
      method: 'POST',
      expectStatus: 201,
    });
    expect(generated.yamlContent).toContain('suite: Imported');
  });

  it('checks project ownership before parsing import content', async () => {
    projectAccess.getProjectOrThrow.mockRejectedValueOnce(new ForbiddenException());

    await expect(
      service.preview(projectId, 'other-company', {
        sourceType: 'OPENAPI',
        content: fixture('openapi.petstore.yaml'),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('builds async polling flow with pollUntil when a status endpoint is selected', async () => {
    const preview = await service.preview(projectId, companyId, {
      sourceType: 'OPENAPI',
      content: fixture('openapi.petstore.yaml'),
    });
    const generated = await service.generateFlow(projectId, companyId, {
      suiteName: 'Async',
      template: 'ASYNC_POLLING',
      operations: [
        preview.operations.find((operation) => operation.id === 'createPet')!,
        preview.operations.find((operation) => operation.id === 'getHealth')!,
      ],
      acknowledgeDestructive: true,
    });

    expect(generated.visualFlow.nodes.map((node) => node.type)).toEqual([
      'apiRequest',
      'pollUntil',
    ]);
    expect(generated.yamlContent).toContain('type: pollUntil');
  });
});
