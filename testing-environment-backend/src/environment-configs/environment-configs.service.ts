import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertEnvironmentConfigDto } from './dto/upsert-environment-config.dto';
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
  ) {}

  async create(projectId: string, companyId: string, dto: UpsertEnvironmentConfigDto) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.prisma.environmentConfig.create({ data: this.toCreateData(projectId, dto) });
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
    const data = this.toUpdateData(dto);
    return this.prisma.environmentConfig.upsert({
      where: { projectId },
      create: { ...this.toCreateData(projectId, dto) },
      update: data,
    });
  }

  async compile(
    projectId: string,
    companyId: string,
    visualConfig: EnvironmentVisualConfig,
  ): Promise<EnvironmentCompileResult> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.compiler.compile(visualConfig);
  }

  private toCreateData(
    projectId: string,
    dto: UpsertEnvironmentConfigDto,
  ): Prisma.EnvironmentConfigUncheckedCreateInput {
    if (dto.visualConfig) {
      const compiled = this.compiler.compile(dto.visualConfig);
      return {
        projectId,
        type: dto.type,
        composeYaml: compiled.composeYaml,
        backendTestYaml: compiled.backendTestYaml,
        visualConfig: dto.visualConfig as unknown as Prisma.InputJsonValue,
      };
    }

    if (!dto.composeYaml?.trim() || !dto.backendTestYaml?.trim()) {
      throw new BadRequestException('Docker Compose YAML and backend-test YAML are required');
    }

    return {
      projectId,
      type: dto.type,
      composeYaml: dto.composeYaml,
      backendTestYaml: dto.backendTestYaml,
      visualConfig: Prisma.JsonNull,
    };
  }

  private toUpdateData(dto: UpsertEnvironmentConfigDto): Prisma.EnvironmentConfigUpdateInput {
    if (dto.visualConfig) {
      const compiled = this.compiler.compile(dto.visualConfig);
      return {
        type: dto.type,
        composeYaml: compiled.composeYaml,
        backendTestYaml: compiled.backendTestYaml,
        visualConfig: dto.visualConfig as unknown as Prisma.InputJsonValue,
      };
    }

    if (!dto.composeYaml?.trim() || !dto.backendTestYaml?.trim()) {
      throw new BadRequestException('Docker Compose YAML and backend-test YAML are required');
    }

    return {
      type: dto.type,
      composeYaml: dto.composeYaml,
      backendTestYaml: dto.backendTestYaml,
      visualConfig: Prisma.JsonNull,
    };
  }
}
