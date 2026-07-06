import { Injectable, NotFoundException } from '@nestjs/common';
import { ArtifactType } from '@prisma/client';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReportArtifactService } from '../artifacts/report-artifact.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly artifacts: ArtifactsService,
    private readonly reports: ReportArtifactService,
  ) {}

  async report(projectId: string, runId: string, companyId: string) {
    await this.assertRunAccess(projectId, runId, companyId);
    const artifact = await this.findRunArtifact(runId, ArtifactType.REPORT_JSON);
    if (artifact) {
      const content = await this.artifacts.read(artifact);
      return JSON.parse(content.toString('utf8'));
    }
    const report = await this.reports.buildLegacyReport(projectId, runId);
    if (!report) {
      throw new NotFoundException('Test run not found');
    }
    return report;
  }

  async logs(projectId: string, runId: string, companyId: string) {
    await this.assertRunAccess(projectId, runId, companyId);
    const chunks = await this.prisma.runnerLogChunk.findMany({
      where: { testRunId: runId },
      orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }],
    });
    if (chunks.length > 0) {
      return chunks.map((chunk) => ({
        id: chunk.id,
        source: chunk.source,
        message: chunk.truncated ? `${chunk.preview}\n[truncated]` : chunk.preview,
        createdAt: chunk.createdAt,
        artifactId: chunk.artifactId,
        byteSize: chunk.byteSize,
        truncated: chunk.truncated,
      }));
    }
    return this.prisma.runnerLog.findMany({
      where: { testRunId: runId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async logChunks(
    projectId: string,
    runId: string,
    companyId: string,
    query: PaginationQueryDto,
  ) {
    await this.assertRunAccess(projectId, runId, companyId);
    const skip = (query.page - 1) * query.limit;
    const where = { testRunId: runId };
    const [chunks, total] = await Promise.all([
      this.prisma.runnerLogChunk.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }],
      }),
      this.prisma.runnerLogChunk.count({ where }),
    ]);
    return {
      data: chunks.map((chunk) => ({
        id: chunk.id,
        source: chunk.source,
        sequence: chunk.sequence,
        message: chunk.truncated ? `${chunk.preview}\n[truncated]` : chunk.preview,
        createdAt: chunk.createdAt,
        artifactId: chunk.artifactId,
        byteSize: chunk.byteSize,
        truncated: chunk.truncated,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async junit(projectId: string, runId: string, companyId: string): Promise<string> {
    await this.assertRunAccess(projectId, runId, companyId);
    const artifact = await this.findRunArtifact(runId, ArtifactType.JUNIT_XML);
    if (artifact) {
      return (await this.artifacts.read(artifact)).toString('utf8');
    }
    const junit = await this.reports.buildLegacyJunit(projectId, runId);
    if (!junit) {
      throw new NotFoundException('Test run not found');
    }
    return junit;
  }

  async downloadArtifact(
    projectId: string,
    runId: string,
    artifactId: string,
    companyId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    await this.assertRunAccess(projectId, runId, companyId);
    const artifact = await this.prisma.artifact.findFirst({
      where: { id: artifactId, testRunId: runId },
    });
    if (!artifact) {
      throw new NotFoundException('Artifact not found');
    }
    const buffer = await this.artifacts.read(artifact);
    return {
      buffer,
      mimeType: artifact.mimeType,
      fileName: this.safeDownloadFileName(
        artifact.objectKey.split('/').at(-1)?.replace(/\.gz$/, '') ?? artifact.id,
      ),
    };
  }

  private async assertRunAccess(projectId: string, runId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const run = await this.prisma.testRun.findFirst({
      where: { id: runId, projectId },
      select: { id: true },
    });
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
  }

  private findRunArtifact(runId: string, type: ArtifactType) {
    return this.prisma.artifact.findFirst({
      where: { testRunId: runId, type },
      orderBy: { createdAt: 'desc' },
    });
  }

  private safeDownloadFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'artifact';
  }
}
