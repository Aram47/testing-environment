import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SecretRotationJobStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  getSecretRotationJobId,
  SECRET_ROTATION_JOB_NAME,
  SECRET_ROTATION_QUEUE,
  SecretRotationJobData,
} from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { SecretCryptoService } from './secret-crypto.service';

@Injectable()
export class SecretRotationService {
  private readonly batchSize = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
    @InjectQueue(SECRET_ROTATION_QUEUE)
    private readonly queue: Queue<SecretRotationJobData>,
  ) {}

  async enqueue(companyId: string, actorUserId?: string) {
    const toKeyVersion = this.crypto.getActiveKeyVersion();
    const fromKeyVersions = await this.prisma.secret.findMany({
      where: { encryptionKeyVersion: { not: toKeyVersion }, project: { companyId } },
      distinct: ['encryptionKeyVersion'],
      select: { encryptionKeyVersion: true },
      orderBy: { encryptionKeyVersion: 'asc' },
    });
    const fromKeyVersion = fromKeyVersions[0]?.encryptionKeyVersion;
    if (!fromKeyVersion) {
      throw new ConflictException('No secrets require key rotation');
    }

    const job =
      (await this.findActiveJob(companyId, fromKeyVersion, toKeyVersion)) ??
      (await this.createJobOrLoadExisting(companyId, fromKeyVersion, toKeyVersion, actorUserId));

    await this.queue.add(
      SECRET_ROTATION_JOB_NAME,
      { rotationJobId: job.id },
      { jobId: getSecretRotationJobId(job.id) },
    );
    return job;
  }

  async process(rotationJobId: string): Promise<void> {
    const job = await this.prisma.secretRotationJob.findUnique({ where: { id: rotationJobId } });
    if (!job) {
      throw new NotFoundException('Secret rotation job not found');
    }
    if (job.status === SecretRotationJobStatus.COMPLETED) {
      return;
    }

    await this.prisma.secretRotationJob.update({
      where: { id: job.id },
      data: {
        status: SecretRotationJobStatus.RUNNING,
        startedAt: job.startedAt ?? new Date(),
        errorMessage: null,
        totalSecrets: await this.countSecrets(job.companyId, job.fromKeyVersion),
      },
    });

    try {
      let processed = job.processedSecrets;
      let lastProcessedSecretId = job.lastProcessedSecretId;
      while (true) {
        const batch = await this.prisma.secret.findMany({
          where: {
            encryptionKeyVersion: job.fromKeyVersion,
            project: { companyId: job.companyId },
            ...(lastProcessedSecretId ? { id: { gt: lastProcessedSecretId } } : {}),
          },
          orderBy: { id: 'asc' },
          take: this.batchSize,
        });
        if (batch.length === 0) {
          break;
        }

        await this.prisma.$transaction(async (tx) => {
          for (const secret of batch) {
            const plaintext = this.crypto.decrypt(
              secret.encryptedValue,
              secret.encryptionKeyVersion,
            );
            await tx.secret.update({
              where: { id: secret.id },
              data: {
                encryptedValue: this.crypto.encrypt(plaintext, job.toKeyVersion),
                encryptionKeyVersion: job.toKeyVersion,
                rotatedAt: new Date(),
              },
            });
            await tx.auditEvent.create({
              data: {
                type: 'secret.rotated',
                companyId: job.companyId,
                projectId: secret.projectId,
                actorUserId: job.actorUserId,
                resourceId: secret.id,
                metadata: {
                  key: secret.key,
                  fromKeyVersion: job.fromKeyVersion,
                  toKeyVersion: job.toKeyVersion,
                  rotationJobId: job.id,
                } satisfies Prisma.InputJsonObject,
              },
            });
          }
          processed += batch.length;
          lastProcessedSecretId = batch[batch.length - 1].id;
          await tx.secretRotationJob.update({
            where: { id: job.id },
            data: { processedSecrets: processed, lastProcessedSecretId },
          });
        });
      }

      await this.prisma.secretRotationJob.update({
        where: { id: job.id },
        data: {
          status: SecretRotationJobStatus.COMPLETED,
          finishedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      await this.prisma.secretRotationJob.update({
        where: { id: job.id },
        data: {
          status: SecretRotationJobStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Secret rotation failed',
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private countSecrets(companyId: string, fromKeyVersion: string): Promise<number> {
    return this.prisma.secret.count({
      where: {
        encryptionKeyVersion: fromKeyVersion,
        project: { companyId },
      },
    });
  }

  private findActiveJob(companyId: string, fromKeyVersion: string, toKeyVersion: string) {
    return this.prisma.secretRotationJob.findFirst({
      where: {
        companyId,
        fromKeyVersion,
        toKeyVersion,
        status: { in: [SecretRotationJobStatus.PENDING, SecretRotationJobStatus.RUNNING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async createJobOrLoadExisting(
    companyId: string,
    fromKeyVersion: string,
    toKeyVersion: string,
    actorUserId?: string,
  ) {
    try {
      return await this.prisma.secretRotationJob.create({
        data: {
          companyId,
          fromKeyVersion,
          toKeyVersion,
          actorUserId,
          totalSecrets: await this.countSecrets(companyId, fromKeyVersion),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.findActiveJob(companyId, fromKeyVersion, toKeyVersion);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }
}
