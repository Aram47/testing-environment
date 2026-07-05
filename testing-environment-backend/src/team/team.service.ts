import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedPrincipal } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../websocket/realtime.service';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateRole(
    companyId: string,
    memberId: string,
    role: UserRole,
    actor: AuthenticatedPrincipal,
  ) {
    const member = await this.findMember(companyId, memberId);
    if (member.role === 'OWNER' && role !== 'OWNER') {
      await this.assertAnotherOwnerExists(companyId, member.userId);
    }

    const updated = await this.prisma.companyMember.update({
      where: { id: memberId },
      data: { role },
    });
    await this.prisma.user.update({ where: { id: member.userId }, data: { role } });
    await this.audit.record({
      action: 'team.member_role_updated',
      principal: actor,
      companyId,
      resourceType: 'companyMember',
      resourceId: memberId,
      metadata: { role },
    });
    return updated;
  }

  async remove(companyId: string, memberId: string, actor: AuthenticatedPrincipal) {
    const member = await this.findMember(companyId, memberId);
    if (member.role === 'OWNER') {
      await this.assertAnotherOwnerExists(companyId, member.userId);
    }

    const removed = await this.prisma.companyMember.update({
      where: { id: memberId },
      data: { status: 'REMOVED', removedAt: new Date() },
    });
    this.realtime.disconnectUser(member.userId);
    await this.audit.record({
      action: 'team.member_removed',
      principal: actor,
      companyId,
      resourceType: 'companyMember',
      resourceId: memberId,
    });
    return removed;
  }

  private async findMember(companyId: string, memberId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId, status: 'ACTIVE' },
    });
    if (!member) {
      throw new NotFoundException('Company member not found');
    }
    return member;
  }

  private async assertAnotherOwnerExists(
    companyId: string,
    excludingUserId: string,
  ): Promise<void> {
    const owners = await this.prisma.companyMember.count({
      where: {
        companyId,
        role: 'OWNER',
        status: 'ACTIVE',
        userId: { not: excludingUserId },
      },
    });
    if (owners < 1) {
      throw new ConflictException('Company must keep at least one active owner');
    }
  }
}
