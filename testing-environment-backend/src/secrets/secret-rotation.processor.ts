import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { SECRET_ROTATION_QUEUE, SecretRotationJobData } from '../queue/queue.constants';
import { SecretRotationService } from './secret-rotation.service';

@Injectable()
@Processor(SECRET_ROTATION_QUEUE, { concurrency: 1 })
export class SecretRotationProcessor extends WorkerHost {
  constructor(private readonly rotation: SecretRotationService) {
    super();
  }

  async process(job: Job<SecretRotationJobData>): Promise<void> {
    await this.rotation.process(job.data.rotationJobId);
  }
}
