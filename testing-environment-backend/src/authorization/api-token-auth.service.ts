import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrincipalType, UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthenticatedPrincipal } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiTokenAuthService {
  constructor(private readonly prisma: PrismaService) {}

  hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async validate(rawToken: string): Promise<AuthenticatedPrincipal> {
    const token = await this.prisma.apiToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
      include: { serviceAccount: true },
    });
    if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= new Date())) {
      throw new UnauthorizedException('Invalid API token');
    }
    if (token.serviceAccount?.revokedAt) {
      throw new UnauthorizedException('Service account is revoked');
    }

    await this.prisma.apiToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      type: PrincipalType.API_TOKEN,
      id: token.id,
      email: token.serviceAccount?.name ?? token.name,
      companyId: token.companyId,
      role: UserRole.OWNER,
      apiTokenId: token.id,
      serviceAccountId: token.serviceAccountId,
      scopes: token.scopes,
      projectId: token.projectId,
    };
  }
}
