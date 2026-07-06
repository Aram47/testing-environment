import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EnvironmentConfig,
  EnvironmentConfigRevision,
  Prisma,
  RevisionStatus,
} from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertEnvironmentConfigDto } from './dto/upsert-environment-config.dto';
import { ComposeToVisualConverterService } from './compose-to-visual-converter.service';
import { ImportComposeDto } from './dto/import-compose.dto';
import { EnvironmentConfigCompilerService } from './environment-config-compiler.service';
import {
  EnvironmentCompileResult,
  EnvironmentVisualConfig,
} from './types/environment-visual-config.types';

@Injectable()
export class EnvironmentConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly compiler: EnvironmentConfigCompilerService,
    private readonly composeImporter: ComposeToVisualConverterService,
  ) {}

  async create(
    projectId: string,
    companyId: string,
    userId: string,
    dto: UpsertEnvironmentConfigDto,
  ) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    await this.writeDraftRevision(async (tx) => {
      const config = await tx.environmentConfig.create({
        data: { projectId, type: dto.type },
      });
      await this.createRevision(tx, config.id, userId, dto);
    });
    return this.find(projectId, companyId);
  }

  async find(projectId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const config = await this.prisma.environmentConfig.findUnique({
      where: { projectId },
      include: { revisions: { orderBy: { revisionNumber: 'desc' } } },
    });
    if (!config) {
      throw new NotFoundException('Environment config not found');
    }
    return this.toResponse(config);
  }

  async update(
    projectId: string,
    companyId: string,
    userId: string,
    dto: UpsertEnvironmentConfigDto,
  ) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    await this.writeDraftRevision(async (tx) => {
      const existing = await tx.environmentConfig.findUnique({
        where: { projectId },
        include: {
          revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 },
        },
      });
      if (existing && dto.baseRevisionId) {
        const currentRevision = existing.revisions[0];
        if (currentRevision && currentRevision.id !== dto.baseRevisionId) {
          throw new ConflictException({
            message: 'Environment config was updated elsewhere',
            currentRevisionId: currentRevision.id,
            currentRevisionNumber: currentRevision.revisionNumber,
          });
        }
      }
      const config = await tx.environmentConfig.upsert({
        where: { projectId },
        create: { projectId, type: dto.type },
        update: { type: dto.type },
      });
      await this.createRevision(tx, config.id, userId, dto);
    });
    return this.find(projectId, companyId);
  }

  async compile(
    projectId: string,
    companyId: string,
    visualConfig: EnvironmentVisualConfig,
  ): Promise<EnvironmentCompileResult> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.compiler.compile(visualConfig);
  }

  async importCompose(projectId: string, companyId: string, dto: ImportComposeDto) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.composeImporter.convert(dto.composeYaml, dto.source);
  }

  async listRevisions(projectId: string, companyId: string) {
    const config = await this.getConfigForProject(projectId, companyId);
    const revisions = await this.prisma.environmentConfigRevision.findMany({
      where: { environmentConfigId: config.id },
      orderBy: { revisionNumber: 'desc' },
    });
    return revisions.map((revision) => this.normalizeRevision(revision));
  }

  async getRevision(projectId: string, companyId: string, revisionId: string) {
    const config = await this.getConfigForProject(projectId, companyId);
    const revision = await this.prisma.environmentConfigRevision.findFirst({
      where: { id: revisionId, environmentConfigId: config.id },
    });
    if (!revision) {
      throw new NotFoundException('Environment config revision not found');
    }
    return this.normalizeRevision(revision);
  }

  async publishRevision(projectId: string, companyId: string, userId: string, revisionId: string) {
    const config = await this.getConfigForProject(projectId, companyId);
    const revision = await this.prisma.environmentConfigRevision.findFirst({
      where: { id: revisionId, environmentConfigId: config.id },
    });
    if (!revision) {
      throw new NotFoundException('Environment config revision not found');
    }
    if (revision.status === RevisionStatus.PUBLISHED) {
      throw new ConflictException('Environment config revision is already published');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.environmentConfigRevision.updateMany({
        where: {
          environmentConfigId: config.id,
          status: RevisionStatus.PUBLISHED,
          id: { not: revision.id },
        },
        data: { status: RevisionStatus.DRAFT, publishedAt: null, publishedById: null },
      });
      const result = await tx.environmentConfigRevision.updateMany({
        where: { id: revision.id, status: RevisionStatus.DRAFT },
        data: {
          status: RevisionStatus.PUBLISHED,
          publishedById: userId,
          publishedAt: new Date(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException('Environment config revision is already published');
      }
    });
    return this.find(projectId, companyId);
  }

  async compareRevisions(projectId: string, companyId: string, fromId: string, toId: string) {
    if (!fromId || !toId) {
      throw new BadRequestException('Both from and to revision IDs are required');
    }
    const config = await this.getConfigForProject(projectId, companyId);
    const revisions = await this.prisma.environmentConfigRevision.findMany({
      where: { environmentConfigId: config.id, id: { in: [fromId, toId] } },
    });
    const from = revisions.find((revision) => revision.id === fromId);
    const to = revisions.find((revision) => revision.id === toId);
    if (!from || !to) {
      throw new NotFoundException('Environment config revision not found');
    }
    return {
      from: this.normalizeRevision(from),
      to: this.normalizeRevision(to),
      diffs: {
        compiledComposeYaml: this.diffLines(from.compiledComposeYaml, to.compiledComposeYaml),
        compiledRuntimeYaml: this.diffLines(from.compiledRuntimeYaml, to.compiledRuntimeYaml),
      },
    };
  }

  private async getConfigForProject(projectId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const config = await this.prisma.environmentConfig.findUnique({ where: { projectId } });
    if (!config) {
      throw new NotFoundException('Environment config not found');
    }
    return config;
  }

  private async createRevision(
    prisma: Prisma.TransactionClient | PrismaService,
    environmentConfigId: string,
    userId: string,
    dto: UpsertEnvironmentConfigDto,
  ) {
    const latest = await prisma.environmentConfigRevision.aggregate({
      where: { environmentConfigId },
      _max: { revisionNumber: true },
    });
    return prisma.environmentConfigRevision.create({
      data: {
        ...this.toRevisionData(dto),
        environmentConfigId,
        revisionNumber: (latest._max.revisionNumber ?? 0) + 1,
        status: RevisionStatus.DRAFT,
        schemaVersion: 1,
        createdById: userId,
      },
    });
  }

  private async writeDraftRevision(
    callback: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.prisma.$transaction(callback);
        return;
      } catch (error) {
        if (attempt === 2 || !this.isRevisionNumberConflict(error)) {
          throw error;
        }
      }
    }
  }

  private isRevisionNumberConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private toRevisionData(
    dto: UpsertEnvironmentConfigDto,
  ): Pick<
    Prisma.EnvironmentConfigRevisionUncheckedCreateInput,
    'sourceMode' | 'compiledComposeYaml' | 'compiledRuntimeYaml' | 'visualConfig'
  > {
    if (dto.visualConfig) {
      const compiled = this.compiler.compile(dto.visualConfig);
      return {
        sourceMode: 'VISUAL',
        compiledComposeYaml: compiled.composeYaml,
        compiledRuntimeYaml: compiled.backendTestYaml,
        visualConfig: dto.visualConfig as unknown as Prisma.InputJsonValue,
      };
    }

    if (dto.type === 'EXTERNAL_URL') {
      if (!dto.backendTestYaml?.trim()) {
        throw new BadRequestException('backend-test YAML is required');
      }
      return {
        sourceMode: 'EXTERNAL_URL',
        compiledComposeYaml: '',
        compiledRuntimeYaml: dto.backendTestYaml,
        visualConfig: Prisma.JsonNull,
      };
    }

    if (!dto.composeYaml?.trim() || !dto.backendTestYaml?.trim()) {
      throw new BadRequestException('Docker Compose YAML and backend-test YAML are required');
    }

    return {
      sourceMode: 'RAW_YAML',
      compiledComposeYaml: dto.composeYaml,
      compiledRuntimeYaml: dto.backendTestYaml,
      visualConfig: Prisma.JsonNull,
    };
  }

  private normalizeSourceMode(sourceMode: string): string {
    return sourceMode === 'YAML' ? 'RAW_YAML' : sourceMode;
  }

  private normalizeRevision(revision: EnvironmentConfigRevision) {
    return {
      ...revision,
      sourceMode: this.normalizeSourceMode(revision.sourceMode),
    };
  }

  private toResponse(config: EnvironmentConfig & { revisions: EnvironmentConfigRevision[] }) {
    const currentRevision = config.revisions[0];
    const publishedRevision = config.revisions
      .filter((revision) => revision.status === RevisionStatus.PUBLISHED)
      .sort((left, right) => right.revisionNumber - left.revisionNumber)[0];
    if (!currentRevision) {
      throw new NotFoundException('Environment config revision not found');
    }
    const normalizedCurrent = this.normalizeRevision(currentRevision);
    return {
      ...config,
      composeYaml: normalizedCurrent.compiledComposeYaml,
      backendTestYaml: normalizedCurrent.compiledRuntimeYaml,
      visualConfig: normalizedCurrent.visualConfig,
      currentRevision: normalizedCurrent,
      publishedRevision: publishedRevision
        ? this.normalizeRevision(publishedRevision)
        : undefined,
      revisions: undefined,
    };
  }

  private diffLines(from: string, to: string) {
    const fromLines = from.split('\n');
    const toLines = to.split('\n');
    const maxLength = Math.max(fromLines.length, toLines.length);
    return Array.from({ length: maxLength }, (_, index) => ({
      line: index + 1,
      from: fromLines[index] ?? null,
      to: toLines[index] ?? null,
      changed: (fromLines[index] ?? null) !== (toLines[index] ?? null),
    })).filter((entry) => entry.changed);
  }
}
