import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertEnvironmentConfigDto } from './dto/upsert-environment-config.dto';

@Injectable()
export class EnvironmentConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async create(projectId: string, companyId: string, dto: UpsertEnvironmentConfigDto) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.prisma.environmentConfig.create({ data: { ...dto, projectId } });
  }

  async find(projectId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const config = await this.prisma.environmentConfig.findUnique({ where: { projectId } });
    if (!config) {
      throw new NotFoundException('Environment config not found');
    }
    return config;
  }

  async update(projectId: string, companyId: string, dto: UpsertEnvironmentConfigDto) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.prisma.environmentConfig.upsert({
      where: { projectId },
      create: { ...dto, projectId },
      update: dto,
    });
  }
}
