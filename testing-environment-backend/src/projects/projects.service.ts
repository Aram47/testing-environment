import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async create(companyId: string, dto: CreateProjectDto) {
    await this.subscriptions.assertCanCreateProject(companyId);
    return this.prisma.project.create({ data: { ...dto, companyId } });
  }

  async findAll(companyId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ProjectWhereInput = { companyId };
    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, companyId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(companyId: string, id: string, dto: UpdateProjectDto) {
    await this.findOne(companyId, id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }
}
