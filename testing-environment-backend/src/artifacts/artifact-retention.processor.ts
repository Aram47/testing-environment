import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ARTIFACT_RETENTION_QUEUE } from '../queue/queue.constants';
import { ArtifactRetentionService } from './artifact-retention.service';

@Injectable()
@Processor(ARTIFACT_RETENTION_QUEUE, { concurrency: 1 })
export class ArtifactRetentionProcessor extends WorkerHost {
  constructor(private readonly retention: ArtifactRetentionService) {
    super();
  }

  async process(): Promise<void> {
    await this.retention.cleanupExpired();
  }
}
