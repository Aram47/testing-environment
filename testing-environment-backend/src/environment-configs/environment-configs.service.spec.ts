import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, RevisionStatus } from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentConfigCompilerService } from './environment-config-compiler.service';
import { ComposeToVisualConverterService } from './compose-to-visual-converter.service';
import { EnvironmentConfigsService } from './environment-configs.service';

describe('EnvironmentConfigsService', () => {
  const projectId = 'project-1';
  const companyId = 'company-1';
  const userId = 'user-1';
  let prisma: {
    environmentConfig: {
      create: jest.Mock;
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
    environmentConfigRevision: {
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
  let service: EnvironmentConfigsService;

  beforeEach(() => {
    const config = { id: 'config-1', projectId, type: 'DOCKER_COMPOSE' };
    prisma = {
      environmentConfig: {
        create: jest.fn(() => Promise.resolve(config)),
        upsert: jest.fn(() => Promise.resolve(config)),
        findUnique: jest.fn(() =>
          Promise.resolve({
            ...config,
            revisions: [
              {
                id: 'revision-1',
                revisionNumber: 1,
                status: RevisionStatus.DRAFT,
                compiledComposeYaml: 'services: {}\n',
                compiledRuntimeYaml: 'version: "1.0"\n',
                visualConfig: Prisma.JsonNull,
              },
            ],
          }),
        ),
      },
      environmentConfigRevision: {
        aggregate: jest.fn(() => Promise.resolve({ _max: { revisionNumber: 1 } })),
        create: jest.fn(({ data }: { data: unknown }) => Promise.resolve(data)),
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'revision-1',
            environmentConfigId: 'config-1',
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
    service = new EnvironmentConfigsService(
      prisma as unknown as PrismaService,
      projectAccess as unknown as ProjectAccessService,
      new EnvironmentConfigCompilerService(),
      { convert: jest.fn() } as unknown as ComposeToVisualConverterService,
    );
  });

  it('creates a draft revision for legacy YAML save', async () => {
    await service.update(projectId, companyId, userId, {
      type: 'DOCKER_COMPOSE',
      composeYaml: 'services: {}\n',
      backendTestYaml: 'version: "1.0"\n',
    });

    expect(prisma.environmentConfigRevision.create).toHaveBeenCalledWith({
      data: {
        environmentConfigId: 'config-1',
        revisionNumber: 2,
        status: RevisionStatus.DRAFT,
        schemaVersion: 1,
        sourceMode: 'RAW_YAML',
        compiledComposeYaml: 'services: {}\n',
        compiledRuntimeYaml: 'version: "1.0"\n',
        visualConfig: Prisma.JsonNull,
        createdById: userId,
      },
    });
  });

  it('publishes a draft revision without changing content', async () => {
    await service.publishRevision(projectId, companyId, userId, 'revision-1');

    expect(prisma.environmentConfigRevision.updateMany).toHaveBeenCalledWith({
      where: {
        environmentConfigId: 'config-1',
        status: RevisionStatus.PUBLISHED,
        id: { not: 'revision-1' },
      },
      data: { status: RevisionStatus.DRAFT, publishedAt: null, publishedById: null },
    });
    expect(prisma.environmentConfigRevision.updateMany).toHaveBeenCalledWith({
      where: { id: 'revision-1', status: RevisionStatus.DRAFT },
      data: {
        status: RevisionStatus.PUBLISHED,
        publishedById: userId,
        publishedAt: expect.any(Date),
      },
    });
  });

  it('rejects save when baseRevisionId does not match current revision', async () => {
    prisma.environmentConfig.findUnique.mockResolvedValueOnce({
      id: 'config-1',
      projectId,
      type: 'DOCKER_COMPOSE',
      revisions: [
        {
          id: 'revision-2',
          revisionNumber: 2,
          status: RevisionStatus.DRAFT,
        },
      ],
    });

    await expect(
      service.update(projectId, companyId, userId, {
        type: 'DOCKER_COMPOSE',
        composeYaml: 'services: {}\n',
        backendTestYaml: 'version: "1.0"\n',
        baseRevisionId: 'revision-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.environmentConfigRevision.create).not.toHaveBeenCalled();
  });

  it('returns the latest revision as current even when older drafts exist', async () => {
    prisma.environmentConfig.findUnique.mockResolvedValueOnce({
      id: 'config-1',
      projectId,
      type: 'DOCKER_COMPOSE',
      revisions: [
        {
          id: 'revision-3',
          revisionNumber: 3,
          status: RevisionStatus.PUBLISHED,
          compiledComposeYaml: 'services: { app: {} }\n',
          compiledRuntimeYaml: 'version: "1.0"\n',
          visualConfig: Prisma.JsonNull,
        },
        {
          id: 'revision-2',
          revisionNumber: 2,
          status: RevisionStatus.DRAFT,
          compiledComposeYaml: 'services: {}\n',
          compiledRuntimeYaml: 'version: "1.0"\n',
          visualConfig: Prisma.JsonNull,
        },
      ],
    });

    const config = await service.find(projectId, companyId);

    expect(config.currentRevision.id).toBe('revision-3');
  });

  it('rejects publishing an already published revision', async () => {
    prisma.environmentConfigRevision.findFirst.mockResolvedValueOnce({
      id: 'revision-1',
      environmentConfigId: 'config-1',
      status: RevisionStatus.PUBLISHED,
    });

    await expect(
      service.publishRevision(projectId, companyId, userId, 'revision-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a concurrent publish that already consumed the draft state', async () => {
    prisma.environmentConfigRevision.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      service.publishRevision(projectId, companyId, userId, 'revision-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('checks project ownership before reading revision history', async () => {
    projectAccess.getProjectOrThrow.mockRejectedValueOnce(new ForbiddenException());

    await expect(service.listRevisions(projectId, 'other-company')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.environmentConfigRevision.findMany).not.toHaveBeenCalled();
  });

  it('rejects revision compare without both revision IDs', async () => {
    await expect(
      service.compareRevisions(projectId, companyId, '', 'revision-2'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
