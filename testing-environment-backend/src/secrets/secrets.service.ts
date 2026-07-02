import { Injectable, NotFoundException } from '@nestjs/common';
import { Secret } from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSecretDto } from './dto/create-secret.dto';
import { SecretCryptoService } from './secret-crypto.service';

type SafeSecret = Omit<Secret, 'encryptedValue'>;

@Injectable()
export class SecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly crypto: SecretCryptoService,
  ) {}

  async create(projectId: string, companyId: string, dto: CreateSecretDto): Promise<SafeSecret> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const secret = await this.prisma.secret.upsert({
      where: { projectId_key: { projectId, key: dto.key } },
      create: { projectId, key: dto.key, encryptedValue: this.crypto.encrypt(dto.value) },
      update: { encryptedValue: this.crypto.encrypt(dto.value) },
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

  async delete(projectId: string, secretId: string, companyId: string) {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    const secret = await this.prisma.secret.findFirst({ where: { id: secretId, projectId } });
    if (!secret) {
      throw new NotFoundException('Secret not found');
    }
    await this.prisma.secret.delete({ where: { id: secretId } });
    return { deleted: true };
  }

  private safe(secret: Secret): SafeSecret {
    const safe = { ...secret };
    delete (safe as Partial<Secret>).encryptedValue;
    return safe as SafeSecret;
  }
}
