import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SubscriptionPlanName, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; user: Omit<User, 'passwordHash'> }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const freePlan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: SubscriptionPlanName.FREE },
    });
    if (!freePlan) {
      throw new ConflictException('Subscription plans are not seeded');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          subscriptionPlanId: freePlan.id,
        },
      });
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'OWNER',
          companyId: company.id,
        },
      });
      await tx.companyMember.create({
        data: {
          companyId: company.id,
          userId: createdUser.id,
          role: 'OWNER',
        },
      });
      return createdUser;
    });

    return { accessToken: this.sign(user), user: this.safeUser(user) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; user: Omit<User, 'passwordHash'> }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: user.companyId, userId: user.id } },
    });
    if (!member || member.status !== 'ACTIVE') {
      throw new UnauthorizedException('Company membership is inactive');
    }
    return { accessToken: this.sign(user), user: this.safeUser(user) };
  }

  async me(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.safeUser(user);
  }

  private sign(user: User): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, companyId: user.companyId, role: user.role },
      { expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m') },
    );
  }

  private safeUser(user: User): Omit<User, 'passwordHash'> {
    const safe = { ...user };
    delete (safe as Partial<User>).passwordHash;
    return safe as Omit<User, 'passwordHash'>;
  }
}
