import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SecretAuditInput {
  type: 'secret.created' | 'secret.deleted' | 'secret.rotated' | 'secret.used_by_run';
  companyId?: string;
  projectId?: string;
  actorUserId?: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class SecretAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: SecretAuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        type: input.type,
        action: input.type,
        companyId: input.companyId,
        projectId: input.projectId,
        resourceType: 'secret',
        actorUserId: input.actorUserId,
        resourceId: input.resourceId,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }
}
