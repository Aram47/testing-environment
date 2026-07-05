import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Artifact } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  ARTIFACT_RETENTION_JOB_NAME,
  ARTIFACT_RETENTION_QUEUE,
  ArtifactRetentionJobData,
} from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ArtifactsService } from './artifacts.service';

@Injectable()
export class ArtifactRetentionService implements OnModuleInit {
  private readonly logger = new Logger(ArtifactRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly artifacts: ArtifactsService,
    @InjectQueue(ARTIFACT_RETENTION_QUEUE)
    private readonly queue: Queue<ArtifactRetentionJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      ARTIFACT_RETENTION_JOB_NAME,
      {},
      {
        jobId: ARTIFACT_RETENTION_JOB_NAME,
        repeat: { every: 60 * 60 * 1000 },
      },
    );
  }

  async cleanupExpired(now = new Date()): Promise<number> {
    const expired = await this.prisma.artifact.findMany({
      where: { retentionUntil: { lt: now } },
      take: 100,
    });
    let deleted = 0;
    for (const artifact of expired) {
      await this.deleteArtifact(artifact);
      deleted += 1;
    }
    return deleted;
  }

  private async deleteArtifact(artifact: Artifact): Promise<void> {
    await this.artifacts.deleteObject(artifact.objectKey).catch((error) => {
      this.logger.warn(
        `Failed to delete artifact object ${artifact.objectKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
    await this.prisma.$transaction([
      this.prisma.runnerLogChunk.updateMany({
        where: { artifactId: artifact.id },
        data: { artifactId: null },
      }),
      this.prisma.testResult.updateMany({
        where: { responseArtifactId: artifact.id },
        data: { responseArtifactId: null },
      }),
      this.prisma.artifact.delete({ where: { id: artifact.id } }),
    ]);
  }
}
