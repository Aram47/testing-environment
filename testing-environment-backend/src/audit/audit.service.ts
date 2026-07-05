import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';
import { AuthenticatedPrincipal } from '../common/types/authenticated-user.type';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditSanitizerService } from './audit-sanitizer.service';

export interface AuditRecordInput {
  action: string;
  companyId?: string;
  projectId?: string;
  principal?: AuthenticatedPrincipal;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
  metadata?: unknown;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sanitizer: AuditSanitizerService,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    const metadata = this.sanitizer.sanitize(input.metadata);
    await this.prisma.auditEvent.create({
      data: {
        type: input.action,
        action: input.action,
        companyId: input.companyId ?? input.principal?.companyId,
        projectId: input.projectId,
        actorType: input.principal?.type ?? 'USER',
        actorUserId: input.principal?.userId,
        serviceAccountId: input.principal?.serviceAccountId,
        apiTokenId: input.principal?.apiTokenId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        requestId: input.requestId,
        metadata: metadata === undefined ? Prisma.JsonNull : (metadata as Prisma.InputJsonValue),
      },
    });
  }

  async list(
    companyId: string,
    query: AuditEventsQueryDto,
  ): Promise<PaginatedResult<Prisma.AuditEventGetPayload<Record<string, never>>>> {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.AuditEventWhereInput = {
      companyId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
