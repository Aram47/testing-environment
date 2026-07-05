import { Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RequiredPermission, ResolvedResource } from './permission.types';

type RequestWithParams = Request & { params: Record<string, string | undefined> };

@Injectable()
export class ResourceResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    request: RequestWithParams,
    permission: RequiredPermission,
  ): Promise<ResolvedResource> {
    const params = request.params ?? {};
    const resourceType = permission.resourceType;

    if (params.runId) {
      const run = await this.prisma.testRun.findFirst({
        where: { id: params.runId, ...(params.projectId ? { projectId: params.projectId } : {}) },
        select: { id: true, projectId: true, project: { select: { companyId: true } } },
      });
      if (!run) {
        throw new NotFoundException('Test run not found');
      }
      return {
        type: 'run',
        id: run.id,
        projectId: run.projectId,
        companyId: run.project.companyId,
      };
    }

    if (params.secretId) {
      const secret = await this.prisma.secret.findFirst({
        where: {
          id: params.secretId,
          ...(params.projectId ? { projectId: params.projectId } : {}),
        },
        select: { id: true, projectId: true, project: { select: { companyId: true } } },
      });
      if (!secret) {
        throw new NotFoundException('Secret not found');
      }
      return {
        type: 'secret',
        id: secret.id,
        projectId: secret.projectId,
        companyId: secret.project.companyId,
      };
    }

    if (params.suiteId) {
      const suite = await this.prisma.testSuite.findFirst({
        where: { id: params.suiteId, ...(params.projectId ? { projectId: params.projectId } : {}) },
        select: { id: true, projectId: true, project: { select: { companyId: true } } },
      });
      if (!suite) {
        throw new NotFoundException('Test suite not found');
      }
      if (params.revisionId) {
        await this.assertSuiteRevision(params.revisionId, suite.id);
        return {
          type: 'revision',
          id: params.revisionId,
          projectId: suite.projectId,
          companyId: suite.project.companyId,
        };
      }
      return {
        type: 'suite',
        id: suite.id,
        projectId: suite.projectId,
        companyId: suite.project.companyId,
      };
    }

    if (params.revisionId && params.projectId) {
      const revision = await this.prisma.environmentConfigRevision.findFirst({
        where: {
          id: params.revisionId,
          environmentConfig: { projectId: params.projectId },
        },
        select: {
          id: true,
          environmentConfig: {
            select: { projectId: true, project: { select: { companyId: true } } },
          },
        },
      });
      if (!revision) {
        throw new NotFoundException('Revision not found');
      }
      return {
        type: 'revision',
        id: revision.id,
        projectId: revision.environmentConfig.projectId,
        companyId: revision.environmentConfig.project.companyId,
      };
    }

    const projectId = params.projectId ?? params.id;
    if (projectId && this.isProjectBound(resourceType)) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, companyId: true },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      return {
        type: resourceType === 'environment' ? 'environment' : 'project',
        id: project.id,
        projectId: project.id,
        companyId: project.companyId,
      };
    }

    return { type: resourceType ?? 'company' };
  }

  private async assertSuiteRevision(revisionId: string, suiteId: string): Promise<void> {
    const revision = await this.prisma.testSuiteRevision.findFirst({
      where: { id: revisionId, testSuiteId: suiteId },
      select: { id: true },
    });
    if (!revision) {
      throw new NotFoundException('Revision not found');
    }
  }

  private isProjectBound(resourceType?: string): boolean {
    return ['environment', 'project', 'run', 'secret', 'suite', 'revision'].includes(
      resourceType ?? '',
    );
  }
}
