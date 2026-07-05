import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

interface JwtPayload {
  sub: string;
  email: string;
  companyId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
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
  }
}
