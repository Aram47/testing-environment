import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  async create(projectId: string, companyId: string, dto: CreateTestSuiteDto) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.prisma.testSuite.create({ data: this.toCreateData(projectId, dto) });
  }

  async list(projectId: string, companyId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.TestSuiteWhereInput = { projectId };
    const [data, total] = await Promise.all([
      this.prisma.testSuite.findMany({ where, skip, take: query.limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.testSuite.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async find(projectId: string, suiteId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const suite = await this.prisma.testSuite.findFirst({ where: { id: suiteId, projectId } });
    if (!suite) {
      throw new NotFoundException('Test suite not found');
    }
    return suite;
  }

  async update(projectId: string, suiteId: string, companyId: string, dto: UpdateTestSuiteDto) {
    await this.find(projectId, suiteId, companyId);
    return this.prisma.testSuite.update({ where: { id: suiteId }, data: this.toUpdateData(dto) });
  }

  async delete(projectId: string, suiteId: string, companyId: string) {
    await this.find(projectId, suiteId, companyId);
    await this.prisma.testSuite.delete({ where: { id: suiteId } });
    return { deleted: true };
  }

  compileFlow(projectId: string, companyId: string, flow: FlowSuiteDefinition): Promise<FlowCompileResult> {
    return this.projectAccess.getProjectOrThrow(projectId, companyId).then(() => this.flowCompiler.compile(flow));
  }

  private toCreateData(projectId: string, dto: CreateTestSuiteDto): Prisma.TestSuiteUncheckedCreateInput {
    if (dto.visualFlow) {
      const compiled = this.flowCompiler.compile(dto.visualFlow);
      return {
        projectId,
        name: dto.name,
        yamlContent: compiled.yamlContent,
        visualFlow: dto.visualFlow as unknown as Prisma.InputJsonValue,
      };
    }

    if (!dto.yamlContent?.trim()) {
      throw new BadRequestException('YAML content or visual flow is required');
    }

    return {
      projectId,
      name: dto.name,
      yamlContent: dto.yamlContent,
      visualFlow: Prisma.JsonNull,
    };
  }

  private toUpdateData(dto: UpdateTestSuiteDto): Prisma.TestSuiteUpdateInput {
    if (dto.visualFlow) {
      const compiled = this.flowCompiler.compile(dto.visualFlow);
      return {
        name: dto.name ?? dto.visualFlow.suiteName,
        yamlContent: compiled.yamlContent,
        visualFlow: dto.visualFlow as unknown as Prisma.InputJsonValue,
      };
    }

    if (dto.yamlContent !== undefined && !dto.yamlContent.trim()) {
      throw new BadRequestException('YAML content is required');
    }

    return {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.yamlContent === undefined ? {} : { yamlContent: dto.yamlContent, visualFlow: Prisma.JsonNull }),
    };
  }
}
