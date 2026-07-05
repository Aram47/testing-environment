import { Injectable } from '@nestjs/common';
import { ArtifactCompression, ArtifactType, RunnerLogSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { truncateTextByBytes } from './artifact-utils';
import { ArtifactsService } from './artifacts.service';

@Injectable()
export class ArtifactLogWriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artifacts: ArtifactsService,
    private readonly metrics: MetricsService,
  ) {}

  async append(testRunId: string, source: RunnerLogSource, message: string): Promise<void> {
    const totalLimit = this.artifacts.totalLogLimitBytes();
    const existingBytes = await this.currentLogBytes(testRunId);
    if (existingBytes >= totalLimit) {
      const marker = await this.createLimitMarker(testRunId, source);
      if (marker) {
        await this.rebuildSourceArtifact(testRunId, source);
      }
      return;
    }

    const availableBytes = totalLimit - existingBytes;
    const rawMessage = Buffer.from(message, 'utf8');
    const limitedMessage =
      rawMessage.byteLength > availableBytes
        ? rawMessage.subarray(0, availableBytes).toString('utf8')
        : message;
    const truncated = rawMessage.byteLength > availableBytes;
    const chunk = await this.createChunk(
      testRunId,
      source,
      limitedMessage,
      truncated,
      Buffer.byteLength(limitedMessage, 'utf8'),
    );
    this.metrics.incrementLogBytes(source, chunk.byteSize);
    await this.rebuildSourceArtifact(testRunId, source, chunk.artifactId ?? undefined);
  }

  private async currentLogBytes(testRunId: string): Promise<number> {
    const result = await this.prisma.runnerLogChunk.aggregate({
      where: { testRunId },
      _sum: { byteSize: true },
    });
    return result._sum.byteSize ?? 0;
  }

  private async createChunk(
    testRunId: string,
    source: RunnerLogSource,
    message: string,
    truncated: boolean,
    byteSize: number,
  ) {
    const latest = await this.prisma.runnerLogChunk.findFirst({
      where: { testRunId, source },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });
    const preview = truncateTextByBytes(message, this.artifacts.previewLimitBytes());
    return this.prisma.runnerLogChunk.create({
      data: {
        testRunId,
        source,
        sequence: (latest?.sequence ?? 0) + 1,
        preview: preview.preview,
        byteSize,
        truncated: truncated || preview.truncated,
      },
    });
  }

  private async createLimitMarker(testRunId: string, source: RunnerLogSource) {
    const latest = await this.prisma.runnerLogChunk.findFirst({
      where: { testRunId, source },
      orderBy: { sequence: 'desc' },
      select: { byteSize: true, truncated: true },
    });
    if (latest?.truncated && latest.byteSize === 0) {
      return null;
    }
    return this.createChunk(testRunId, source, '', true, 0);
  }

  private async rebuildSourceArtifact(
    testRunId: string,
    source: RunnerLogSource,
    previousArtifactId?: string,
  ): Promise<void> {
    const where =
      source === RunnerLogSource.DOCKER
        ? { testRunId, source }
        : { testRunId, source: { not: RunnerLogSource.DOCKER } };
    const chunks = await this.prisma.runnerLogChunk.findMany({
      where,
      orderBy:
        source === RunnerLogSource.DOCKER
          ? { sequence: 'asc' }
          : [{ createdAt: 'asc' }, { sequence: 'asc' }],
    });
    const content =
      source !== RunnerLogSource.DOCKER
        ? chunks
            .map((chunk) =>
              JSON.stringify({
                sequence: chunk.sequence,
                source: chunk.source,
                message: chunk.preview,
                truncated: chunk.truncated,
                createdAt: chunk.createdAt.toISOString(),
              }),
            )
            .join('\n')
        : chunks.map((chunk) => chunk.preview).join('\n');
    const artifact = await this.artifacts.putOrReplace({
      testRunId,
      type: this.toArtifactType(source),
      objectKey: this.objectKey(testRunId, source),
      mimeType: source === RunnerLogSource.DOCKER ? 'text/plain' : 'application/x-ndjson',
      data: Buffer.from(content + (content ? '\n' : ''), 'utf8'),
      compression: ArtifactCompression.GZIP,
      retentionUntil: this.artifacts.retentionUntil(),
    });
    if (!previousArtifactId || previousArtifactId !== artifact.id) {
      await this.prisma.runnerLogChunk.updateMany({
        where: { ...where, artifactId: null },
        data: { artifactId: artifact.id },
      });
    }
  }

  private objectKey(testRunId: string, source: RunnerLogSource): string {
    if (source === RunnerLogSource.DOCKER) {
      return `runs/${testRunId}/logs/docker/compose.log.gz`;
    }
    return `runs/${testRunId}/logs/system.ndjson.gz`;
  }

  private toArtifactType(source: RunnerLogSource): ArtifactType {
    return source === RunnerLogSource.DOCKER ? ArtifactType.DOCKER_LOG : ArtifactType.SYSTEM_LOG;
  }
}
