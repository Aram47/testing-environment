import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ApiTokenAuthService } from '../authorization/api-token-auth.service';
import { PermissionAction } from '../authorization/permission.types';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedPrincipal } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../websocket/realtime.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';

const ALLOWED_SCOPES = new Set<PermissionAction>([
  'audit:read',
  'company:read',
  'environment:read',
  'environment:write',
  'project:read',
  'run:read',
  'run:write',
  'secret:read',
  'secret:write',
  'suite:read',
  'suite:write',
]);

@Injectable()
export class ApiTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenAuth: ApiTokenAuthService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  list(companyId: string) {
    return this.prisma.apiToken.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        scopes: true,
        projectId: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, actor: AuthenticatedPrincipal, dto: CreateApiTokenDto) {
    const scopes = this.normalizeScopes(dto.scopes);
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, companyId },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
    }

    const rawToken = `tep_${randomBytes(32).toString('base64url')}`;
    const token = await this.prisma.apiToken.create({
      data: {
        companyId,
        name: dto.name,
        tokenHash: this.tokenAuth.hash(rawToken),
        scopes,
        projectId: dto.projectId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdById: actor.userId,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        projectId: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.record({
      action: 'api_token.created',
      principal: actor,
      companyId,
      projectId: dto.projectId,
      resourceType: 'apiToken',
      resourceId: token.id,
      metadata: { name: dto.name, scopes, projectId: dto.projectId },
    });

    return { ...token, token: rawToken };
  }

  async revoke(companyId: string, tokenId: string, actor: AuthenticatedPrincipal) {
    const token = await this.prisma.apiToken.findFirst({
      where: { id: tokenId, companyId, revokedAt: null },
    });
    if (!token) {
      throw new NotFoundException('API token not found');
    }
    const revoked = await this.prisma.apiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        scopes: true,
        projectId: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await this.audit.record({
      action: 'api_token.revoked',
      principal: actor,
      companyId,
      projectId: token.projectId ?? undefined,
      resourceType: 'apiToken',
      resourceId: tokenId,
    });
    this.realtime.disconnectApiToken(tokenId);
    return revoked;
  }

  private normalizeScopes(scopes: string[]): string[] {
    const uniqueScopes = [...new Set(scopes)];
    if (
      uniqueScopes.length === 0 ||
      uniqueScopes.some((scope) => !ALLOWED_SCOPES.has(scope as PermissionAction))
    ) {
      throw new BadRequestException('API token scope is not allowed');
    }
    return uniqueScopes;
  }
}
