import { Prisma } from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { FlowSuiteCompilerService } from './flow-suite-compiler.service';
import { TestSuitesService } from './test-suites.service';

describe('TestSuitesService', () => {
  const projectId = 'project-1';
  const companyId = 'company-1';
  let prisma: {
    testSuite: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let service: TestSuitesService;

  beforeEach(() => {
    prisma = {
      testSuite: {
        create: jest.fn(({ data }: { data: unknown }) => Promise.resolve(data)),
        update: jest.fn(({ data }: { data: unknown }) => Promise.resolve(data)),
        findFirst: jest.fn(() => Promise.resolve({ id: 'suite-1', projectId })),
      },
    };
    const projectAccess = {
      getProjectOrThrow: jest.fn(() => Promise.resolve({ id: projectId })),
    };
    service = new TestSuitesService(
      prisma as unknown as PrismaService,
      projectAccess as unknown as ProjectAccessService,
      new FlowSuiteCompilerService(),
    );
  });

  it('preserves legacy YAML create behavior', async () => {
    await service.create(projectId, companyId, {
      name: 'Legacy',
      yamlContent: 'suite: Legacy\ntests: []\n',
    });

    expect(prisma.testSuite.create).toHaveBeenCalledWith({
      data: {
        projectId,
        name: 'Legacy',
        yamlContent: 'suite: Legacy\ntests: []\n',
        visualFlow: Prisma.JsonNull,
      },
    });
  });

  it('stores visual flow and generated YAML on create', async () => {
    const visualFlow = {
      version: '1.0' as const,
      suiteName: 'Visual',
      nodes: [
        { id: 'node-1', position: { x: 0, y: 0 }, name: 'Health', method: 'GET', path: '/health' },
      ],
      edges: [],
    };

    await service.create(projectId, companyId, { name: 'Visual', visualFlow });
    const call = prisma.testSuite.create.mock.calls[0][0] as {
      data: { yamlContent: string; visualFlow: unknown };
    };

    expect(call.data.yamlContent).toContain('suite: Visual');
    expect(call.data.visualFlow).toEqual(visualFlow);
  });

  it('stores visual flow and generated YAML on update', async () => {
    const visualFlow = {
      version: '1.0' as const,
      suiteName: 'Visual',
      nodes: [
        { id: 'node-1', position: { x: 0, y: 0 }, name: 'Health', method: 'GET', path: '/health' },
      ],
      edges: [],
    };

    await service.update(projectId, 'suite-1', companyId, { visualFlow });
    const call = prisma.testSuite.update.mock.calls[0][0] as {
      data: { name: string; yamlContent: string; visualFlow: unknown };
    };

    expect(call.data.name).toBe('Visual');
    expect(call.data.yamlContent).toContain('name: Health');
    expect(call.data.visualFlow).toEqual(visualFlow);
  });
});
