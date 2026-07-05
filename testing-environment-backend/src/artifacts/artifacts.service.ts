import { Inject, Injectable } from '@nestjs/common';
import { ArtifactCompression, ArtifactType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { ARTIFACT_STORAGE, ArtifactStorage } from './artifact-storage.interface';
import { gzipBuffer, gunzipBuffer } from './artifact-utils';

export interface CreateArtifactInput {
  testRunId: string;
  stepId?: string | null;
  type: ArtifactType;
  objectKey: string;
  mimeType: string;
  data: Buffer;
  compression?: ArtifactCompression;
  retentionUntil: Date;
}

@Injectable()
export class ArtifactsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ARTIFACT_STORAGE) private readonly storage: ArtifactStorage,
    private readonly metrics: MetricsService,
  ) {}

  async create(input: CreateArtifactInput) {
    const payload =
      input.compression === ArtifactCompression.GZIP ? await gzipBuffer(input.data) : input.data;
    const stored = await this.storage.put({ objectKey: input.objectKey, data: payload });
    const artifact = await this.prisma.artifact.create({
      data: {
        testRunId: input.testRunId,
        stepId: input.stepId ?? undefined,
        type: input.type,
        objectKey: stored.objectKey,
        mimeType: input.mimeType,
        byteSize: stored.byteSize,
        checksum: stored.checksum,
        compression: input.compression ?? ArtifactCompression.NONE,
        retentionUntil: input.retentionUntil,
      },
    });
    this.metrics.incrementArtifactBytes(input.type, stored.byteSize);
    return artifact;
  }

  async putOrReplace(input: CreateArtifactInput) {
    const payload =
      input.compression === ArtifactCompression.GZIP ? await gzipBuffer(input.data) : input.data;
    const stored = await this.storage.put({ objectKey: input.objectKey, data: payload });
    const artifact = await this.prisma.artifact.upsert({
      where: { objectKey: stored.objectKey },
      create: {
        testRunId: input.testRunId,
        stepId: input.stepId ?? undefined,
        type: input.type,
        objectKey: stored.objectKey,
        mimeType: input.mimeType,
        byteSize: stored.byteSize,
        checksum: stored.checksum,
        compression: input.compression ?? ArtifactCompression.NONE,
        retentionUntil: input.retentionUntil,
      },
      update: {
        stepId: input.stepId ?? undefined,
        type: input.type,
        mimeType: input.mimeType,
        byteSize: stored.byteSize,
        checksum: stored.checksum,
        compression: input.compression ?? ArtifactCompression.NONE,
        retentionUntil: input.retentionUntil,
      },
    });
    this.metrics.incrementArtifactBytes(input.type, stored.byteSize);
    return artifact;
  }

  async read(artifact: { objectKey: string; compression: ArtifactCompression }): Promise<Buffer> {
    const payload = await this.storage.get(artifact.objectKey);
    return artifact.compression === ArtifactCompression.GZIP ? gunzipBuffer(payload) : payload;
  }

  async createDownloadUrl(objectKey: string): Promise<string> {
    return this.storage.createDownloadUrl(objectKey);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.storage.delete(objectKey);
  }

  previewLimitBytes(): number {
    return this.positiveNumber(process.env.ARTIFACT_PREVIEW_LIMIT_BYTES, 16 * 1024);
  }

  totalLogLimitBytes(): number {
    return this.positiveNumber(process.env.ARTIFACT_TOTAL_LOG_LIMIT_BYTES, 10 * 1024 * 1024);
  }

  retentionUntil(days?: number): Date {
    const retentionDays = this.positiveNumber(
      process.env.ARTIFACT_RETENTION_DAYS,
      days && days > 0 ? days : 30,
    );
    return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  }

  private positiveNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
