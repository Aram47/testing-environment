import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';

@Injectable()
export class TestSuitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async create(projectId: string, companyId: string, dto: CreateTestSuiteDto) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.prisma.testSuite.create({ data: { ...dto, projectId } });
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
    return this.prisma.testSuite.update({ where: { id: suiteId }, data: dto });
  }

  async delete(projectId: string, suiteId: string, companyId: string) {
    await this.find(projectId, suiteId, companyId);
    await this.prisma.testSuite.delete({ where: { id: suiteId } });
    return { deleted: true };
  }
}
