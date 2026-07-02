import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectOrThrow(projectId: string, companyId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.companyId !== companyId) {
      throw new ForbiddenException('Project belongs to another company');
    }
    return project;
  }
}
