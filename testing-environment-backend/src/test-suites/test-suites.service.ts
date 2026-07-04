import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RevisionStatus, TestSuite, TestSuiteRevision } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';
import { FlowSuiteCompilerService } from './flow-suite-compiler.service';
import { FlowCompileResult, FlowSuiteDefinition } from './types/flow-suite.types';

@Injectable()
export class TestSuitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly flowCompiler: FlowSuiteCompilerService,
  ) {}

  async create(projectId: string, companyId: string, userId: string, dto: CreateTestSuiteDto) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const suite = await this.writeDraftRevision(async (tx) => {
      const createdSuite = await tx.testSuite.create({
        data: { projectId, name: dto.name },
      });
      await this.createRevision(tx, createdSuite.id, userId, dto);
      return createdSuite;
    });
    return this.find(projectId, suite.id, companyId);
  }

  async list(
    projectId: string,
    companyId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.TestSuiteWhereInput = { projectId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.testSuite.findMany({
        where,
        include: { revisions: { orderBy: { revisionNumber: 'desc' } } },
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.testSuite.count({ where }),
    ]);
    return {
      data: data.map((suite) => this.toResponse(suite)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async find(projectId: string, suiteId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const suite = await this.prisma.testSuite.findFirst({
      where: { id: suiteId, projectId, deletedAt: null },
      include: { revisions: { orderBy: { revisionNumber: 'desc' } } },
    });
    if (!suite) {
      throw new NotFoundException('Test suite not found');
    }
    return this.toResponse(suite);
  }

  async update(
    projectId: string,
    suiteId: string,
    companyId: string,
    userId: string,
    dto: UpdateTestSuiteDto,
  ) {
    await this.getSuiteForProject(projectId, suiteId, companyId);
    if (!dto.visualFlow && dto.yamlContent === undefined) {
      if (!dto.name) {
        throw new BadRequestException(
          'Test suite update must include a name, YAML content, or visual flow',
        );
      }
      await this.prisma.testSuite.update({ where: { id: suiteId }, data: { name: dto.name } });
      return this.find(projectId, suiteId, companyId);
    }
    await this.writeDraftRevision(async (tx) => {
      if (dto.name || dto.visualFlow?.suiteName) {
        await tx.testSuite.update({
          where: { id: suiteId },
          data: { name: dto.name ?? dto.visualFlow?.suiteName },
        });
      }
      await this.createRevision(tx, suiteId, userId, dto);
    });
    return this.find(projectId, suiteId, companyId);
  }

  async delete(projectId: string, suiteId: string, companyId: string) {
    await this.getSuiteForProject(projectId, suiteId, companyId);
    await this.prisma.testSuite.update({ where: { id: suiteId }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  compileFlow(
    projectId: string,
    companyId: string,
    flow: FlowSuiteDefinition,
  ): Promise<FlowCompileResult> {
    return this.projectAccess
      .getProjectOrThrow(projectId, companyId)
      .then(() => this.flowCompiler.compile(flow));
  }

  async listRevisions(projectId: string, suiteId: string, companyId: string) {
    await this.getSuiteForProject(projectId, suiteId, companyId);
    return this.prisma.testSuiteRevision.findMany({
      where: { testSuiteId: suiteId },
      orderBy: { revisionNumber: 'desc' },
    });
  }

  async publishRevision(
    projectId: string,
    suiteId: string,
    companyId: string,
    userId: string,
    revisionId: string,
  ) {
    await this.getSuiteForProject(projectId, suiteId, companyId);
    const revision = await this.prisma.testSuiteRevision.findFirst({
      where: { id: revisionId, testSuiteId: suiteId },
    });
    if (!revision) {
      throw new NotFoundException('Test suite revision not found');
    }
    if (revision.status === RevisionStatus.PUBLISHED) {
      throw new ConflictException('Test suite revision is already published');
    }
    const result = await this.prisma.testSuiteRevision.updateMany({
      where: { id: revision.id, status: RevisionStatus.DRAFT },
      data: { status: RevisionStatus.PUBLISHED, publishedById: userId, publishedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException('Test suite revision is already published');
    }
    return this.find(projectId, suiteId, companyId);
  }

  async compareRevisions(
    projectId: string,
    suiteId: string,
    companyId: string,
    fromId: string,
    toId: string,
  ) {
    if (!fromId || !toId) {
      throw new BadRequestException('Both from and to revision IDs are required');
    }
    await this.getSuiteForProject(projectId, suiteId, companyId);
    const revisions = await this.prisma.testSuiteRevision.findMany({
      where: { testSuiteId: suiteId, id: { in: [fromId, toId] } },
    });
    const from = revisions.find((revision) => revision.id === fromId);
    const to = revisions.find((revision) => revision.id === toId);
    if (!from || !to) {
      throw new NotFoundException('Test suite revision not found');
    }
    return {
      from,
      to,
      diffs: {
        compiledYaml: this.diffLines(from.compiledYaml, to.compiledYaml),
      },
    };
  }

  private async getSuiteForProject(projectId: string, suiteId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const suite = await this.prisma.testSuite.findFirst({
      where: { id: suiteId, projectId, deletedAt: null },
    });
    if (!suite) {
      throw new NotFoundException('Test suite not found');
    }
    return suite;
  }

  private async createRevision(
    prisma: Prisma.TransactionClient | PrismaService,
    testSuiteId: string,
    userId: string,
    dto: CreateTestSuiteDto | UpdateTestSuiteDto,
  ) {
    const latest = await prisma.testSuiteRevision.aggregate({
      where: { testSuiteId },
      _max: { revisionNumber: true },
    });
    return prisma.testSuiteRevision.create({
      data: {
        ...this.toRevisionData(dto),
        testSuiteId,
        revisionNumber: (latest._max.revisionNumber ?? 0) + 1,
        status: RevisionStatus.DRAFT,
        schemaVersion: 1,
        createdById: userId,
      },
    });
  }

  private async writeDraftRevision<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(callback);
      } catch (error) {
        if (attempt === 2 || !this.isRevisionNumberConflict(error)) {
          throw error;
        }
      }
    }
    throw new Error('Failed to write test suite revision');
  }

  private isRevisionNumberConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private toRevisionData(
    dto: CreateTestSuiteDto | UpdateTestSuiteDto,
  ): Pick<
    Prisma.TestSuiteRevisionUncheckedCreateInput,
    'sourceMode' | 'compiledYaml' | 'visualFlow' | 'executionPlan'
  > {
    if (dto.visualFlow) {
      const compiled = this.flowCompiler.compile(dto.visualFlow);
      return {
        sourceMode: 'VISUAL',
        compiledYaml: compiled.yamlContent,
        visualFlow: dto.visualFlow as unknown as Prisma.InputJsonValue,
        executionPlan: this.toExecutionPlan(dto.name ?? dto.visualFlow.suiteName, 'VISUAL'),
      };
    }

    if (!dto.yamlContent?.trim()) {
      throw new BadRequestException('YAML content or visual flow is required');
    }

    return {
      sourceMode: 'YAML',
      compiledYaml: dto.yamlContent,
      visualFlow: Prisma.JsonNull,
      executionPlan: this.toExecutionPlan(dto.name, 'YAML'),
    };
  }

  private toResponse(suite: TestSuite & { revisions: TestSuiteRevision[] }) {
    const currentRevision = suite.revisions[0];
    const publishedRevision = suite.revisions.find(
      (revision) => revision.status === RevisionStatus.PUBLISHED,
    );
    if (!currentRevision) {
      throw new NotFoundException('Test suite revision not found');
    }
    return {
      ...suite,
      yamlContent: currentRevision.compiledYaml,
      visualFlow: currentRevision.visualFlow,
      currentRevision,
      publishedRevision,
      revisions: undefined,
    };
  }

  private toExecutionPlan(
    suiteName: string | undefined,
    sourceMode: string,
  ): Prisma.InputJsonValue {
    return {
      schemaVersion: 1,
      sourceMode,
      suiteName: suiteName ?? 'Unnamed suite',
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
