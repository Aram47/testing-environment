import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Secret } from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSecretDto } from './dto/create-secret.dto';
import { SecretAuditService } from './secret-audit.service';
import { SecretCryptoService } from './secret-crypto.service';

type SafeSecret = Omit<Secret, 'encryptedValue'>;

@Injectable()
export class SecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly crypto: SecretCryptoService,
    private readonly audit: SecretAuditService,
  ) {}

  async create(
    projectId: string,
    companyId: string,
    userId: string,
    dto: CreateSecretDto,
  ): Promise<SafeSecret> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const activeKeyVersion = this.crypto.getActiveKeyVersion();
    const { secret, wasRotation } = await this.createOrRotateSecret(
      projectId,
      userId,
      dto,
      activeKeyVersion,
    );
    await this.audit.record({
      type: wasRotation ? 'secret.rotated' : 'secret.created',
      companyId,
      projectId,
      actorUserId: userId,
      resourceId: secret.id,
      metadata: { key: secret.key, encryptionKeyVersion: activeKeyVersion },
    });
    return this.safe(secret);
  }

  async list(projectId: string, companyId: string): Promise<SafeSecret[]> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const secrets = await this.prisma.secret.findMany({
      where: { projectId },
      orderBy: { key: 'asc' },
    });
    return secrets.map((secret) => this.safe(secret));
  }

  async delete(projectId: string, secretId: string, companyId: string, userId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const secret = await this.prisma.secret.findFirst({ where: { id: secretId, projectId } });
    if (!secret) {
      throw new NotFoundException('Secret not found');
    }
    await this.prisma.secret.delete({ where: { id: secretId } });
    await this.audit.record({
      type: 'secret.deleted',
      companyId,
      projectId,
      actorUserId: userId,
      resourceId: secret.id,
      metadata: { key: secret.key },
    });
    return { deleted: true };
  }

  private safe(secret: Secret): SafeSecret {
    const safe = { ...secret };
    delete (safe as Partial<Secret>).encryptedValue;
    return safe as SafeSecret;
  }

  private async createOrRotateSecret(
    projectId: string,
    userId: string,
    dto: CreateSecretDto,
    activeKeyVersion: string,
  ): Promise<{ secret: Secret; wasRotation: boolean }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.secret.findUnique({
          where: { projectId_key: { projectId, key: dto.key } },
        });
        if (!existing) {
          const secret = await tx.secret.create({
            data: {
              projectId,
              key: dto.key,
              encryptedValue: this.crypto.encrypt(dto.value, activeKeyVersion),
              encryptionKeyVersion: activeKeyVersion,
              createdById: userId,
            },
          });
          return { secret, wasRotation: false };
        }
        return {
          secret: await this.rotateSecretValue(tx, existing.id, dto.value, activeKeyVersion),
          wasRotation: true,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const secret = await this.prisma.secret.findUniqueOrThrow({
          where: { projectId_key: { projectId, key: dto.key } },
        });
        return {
          secret: await this.rotateSecretValue(this.prisma, secret.id, dto.value, activeKeyVersion),
          wasRotation: true,
        };
      }
      throw error;
    }
  }

  private rotateSecretValue(
    prisma: Prisma.TransactionClient | PrismaService,
    secretId: string,
    value: string,
    activeKeyVersion: string,
  ): Promise<Secret> {
    return prisma.secret.update({
      where: { id: secretId },
      data: {
        encryptedValue: this.crypto.encrypt(value, activeKeyVersion),
        encryptionKeyVersion: activeKeyVersion,
        rotatedAt: new Date(),
      },
    });
  }
}
