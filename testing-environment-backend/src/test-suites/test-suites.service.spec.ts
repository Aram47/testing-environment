import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, RevisionStatus } from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { FlowSuiteCompilerService } from './flow-suite-compiler.service';
import { TestSuitesService } from './test-suites.service';

describe('TestSuitesService', () => {
  const projectId = 'project-1';
  const companyId = 'company-1';
  const userId = 'user-1';
  let prisma: {
    testSuite: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    testSuiteRevision: {
      aggregate: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let projectAccess: {
    getProjectOrThrow: jest.Mock;
  };
  let service: TestSuitesService;

  beforeEach(() => {
    const suite = { id: 'suite-1', projectId, name: 'Suite', deletedAt: null };
    prisma = {
      testSuite: {
        create: jest.fn(() => Promise.resolve(suite)),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...suite, ...data }),
        ),
        findFirst: jest.fn(() =>
          Promise.resolve({
            ...suite,
            revisions: [
              {
                id: 'revision-1',
                revisionNumber: 1,
                status: RevisionStatus.DRAFT,
                compiledYaml: 'suite: Suite\ntests: []\n',
                visualFlow: Prisma.JsonNull,
              },
            ],
          }),
        ),
        findMany: jest.fn(() => Promise.resolve([])),
        count: jest.fn(() => Promise.resolve(0)),
      },
      testSuiteRevision: {
        aggregate: jest.fn(() => Promise.resolve({ _max: { revisionNumber: 1 } })),
        create: jest.fn(({ data }: { data: unknown }) => Promise.resolve(data)),
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'revision-1',
            testSuiteId: 'suite-1',
            status: RevisionStatus.DRAFT,
          }),
        ),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
        findMany: jest.fn(() => Promise.resolve([])),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    };
    projectAccess = {
      getProjectOrThrow: jest.fn(() => Promise.resolve({ id: projectId })),
    };
    service = new TestSuitesService(
      prisma as unknown as PrismaService,
      projectAccess as unknown as ProjectAccessService,
      new FlowSuiteCompilerService(),
    );
  });

  it('creates a draft revision for YAML save', async () => {
    await service.update(projectId, 'suite-1', companyId, userId, {
      name: 'Suite',
      yamlContent: 'suite: Suite\ntests: []\n',
    });

    expect(prisma.testSuiteRevision.create).toHaveBeenCalledWith({
      data: {
        testSuiteId: 'suite-1',
        revisionNumber: 2,
        status: RevisionStatus.DRAFT,
        schemaVersion: 1,
        sourceMode: 'YAML',
        compiledYaml: 'suite: Suite\ntests: []\n',
        visualFlow: Prisma.JsonNull,
        executionPlan: { schemaVersion: 1, sourceMode: 'YAML', suiteName: 'Suite' },
        createdById: userId,
      },
    });
  });

  it('creates visual draft revisions with generated YAML', async () => {
    const visualFlow = {
      version: '1.0' as const,
      suiteName: 'Visual',
      nodes: [
        { id: 'node-1', position: { x: 0, y: 0 }, name: 'Health', method: 'GET', path: '/health' },
      ],
      edges: [],
    };

    await service.update(projectId, 'suite-1', companyId, userId, { visualFlow });
    const call = prisma.testSuiteRevision.create.mock.calls[0][0] as {
      data: { compiledYaml: string; visualFlow: unknown };
    };

    expect(call.data.compiledYaml).toContain('name: Health');
    expect(call.data.visualFlow).toEqual(visualFlow);
  });

  it('keeps name-only updates as logical metadata changes', async () => {
    await service.update(projectId, 'suite-1', companyId, userId, { name: 'Renamed suite' });

    expect(prisma.testSuite.update).toHaveBeenCalledWith({
      where: { id: 'suite-1' },
      data: { name: 'Renamed suite' },
    });
    expect(prisma.testSuiteRevision.create).not.toHaveBeenCalled();
  });

  it('publishes a draft revision without changing content', async () => {
    await service.publishRevision(projectId, 'suite-1', companyId, userId, 'revision-1');

    expect(prisma.testSuiteRevision.updateMany).toHaveBeenCalledWith({
      where: { id: 'revision-1', status: RevisionStatus.DRAFT },
      data: {
        status: RevisionStatus.PUBLISHED,
        publishedById: userId,
        publishedAt: expect.any(Date),
      },
    });
  });

  it('returns the latest revision as current even when older drafts exist', async () => {
    prisma.testSuite.findFirst.mockResolvedValueOnce({
      id: 'suite-1',
      projectId,
      name: 'Suite',
      deletedAt: null,
      revisions: [
        {
          id: 'revision-3',
          revisionNumber: 3,
          status: RevisionStatus.PUBLISHED,
          compiledYaml: 'suite: Published\n',
          visualFlow: Prisma.JsonNull,
        },
        {
          id: 'revision-2',
          revisionNumber: 2,
          status: RevisionStatus.DRAFT,
          compiledYaml: 'suite: Draft\n',
          visualFlow: Prisma.JsonNull,
        },
      ],
    });

    const suite = await service.find(projectId, 'suite-1', companyId);

    expect(suite.currentRevision.id).toBe('revision-3');
  });

  it('rejects publishing an already published revision', async () => {
    prisma.testSuiteRevision.findFirst.mockResolvedValueOnce({
      id: 'revision-1',
      testSuiteId: 'suite-1',
      status: RevisionStatus.PUBLISHED,
    });

    await expect(
      service.publishRevision(projectId, 'suite-1', companyId, userId, 'revision-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a concurrent publish that already consumed the draft state', async () => {
    prisma.testSuiteRevision.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.publishRevision(projectId, 'suite-1', companyId, userId, 'revision-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('checks project ownership before reading revision history', async () => {
    projectAccess.getProjectOrThrow.mockRejectedValueOnce(new ForbiddenException());

    await expect(
      service.listRevisions(projectId, 'suite-1', 'other-company'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.testSuiteRevision.findMany).not.toHaveBeenCalled();
  });

  it('rejects revision compare without both revision IDs', async () => {
    await expect(
      service.compareRevisions(projectId, 'suite-1', companyId, '', 'revision-2'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
