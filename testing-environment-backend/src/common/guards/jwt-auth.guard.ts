import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ApiTokenAuthService } from '../../authorization/api-token-auth.service';
import { AuthenticatedPrincipal } from '../types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly apiTokens: ApiTokenAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedPrincipal }>();
    const token = this.extractBearerToken(request);
    request.user = await this.authenticate(token);
    return true;
  }

  private async authenticate(token: string): Promise<AuthenticatedPrincipal> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        companyId: string;
        role: string;
      }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }
      const member = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: user.companyId, userId: user.id } },
      });
      if (!member || member.status !== 'ACTIVE') {
        throw new UnauthorizedException('Company membership is inactive');
      }
      return {
        type: 'USER',
        id: user.id,
        userId: user.id,
        memberId: member.id,
        email: user.email,
        companyId: user.companyId,
        role: member.role,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      return this.apiTokens.validate(token);
    }
  }

  private extractBearerToken(request: Request): string {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return header.slice('Bearer '.length).trim();
  }
}
