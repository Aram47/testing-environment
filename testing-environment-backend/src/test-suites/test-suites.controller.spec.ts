import { TestSuitesController } from './test-suites.controller';

describe('TestSuitesController import endpoints', () => {
  const user = {
    id: 'user-1',
    companyId: 'company-1',
    email: 'user@example.com',
    role: 'OWNER',
  } as never;
  const service = {} as never;
  const importService = {
    preview: jest.fn(),
    generateFlow: jest.fn(),
  };
  const controller = new TestSuitesController(service, importService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates import preview to ApiImportService with project and company scope', async () => {
    importService.preview.mockResolvedValueOnce({ operations: [] });
    const dto = { sourceType: 'CURL' as const, content: 'curl https://example.test/health' };

    await controller.previewImport('project-1', user, dto);

    expect(importService.preview).toHaveBeenCalledWith('project-1', 'company-1', dto);
  });

  it('delegates imported flow generation to ApiImportService with project and company scope', async () => {
    importService.generateFlow.mockResolvedValueOnce({ visualFlow: { nodes: [], edges: [] } });
    const dto = {
      suiteName: 'Imported',
      template: 'SMOKE_TEST' as const,
      operations: [],
    };

    await controller.generateImportedFlow('project-1', user, dto);

    expect(importService.generateFlow).toHaveBeenCalledWith('project-1', 'company-1', dto);
  });
});
