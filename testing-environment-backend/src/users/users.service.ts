import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findSafeById(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const safe = { ...user };
    delete (safe as Partial<User>).passwordHash;
    return safe as Omit<User, 'passwordHash'>;
  }
}
