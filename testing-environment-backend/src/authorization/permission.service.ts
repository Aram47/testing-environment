import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ProjectRole, UserRole } from '@prisma/client';
import { AuthenticatedPrincipal } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionAction, ResolvedResource } from './permission.types';

const API_TOKEN_ALLOWED_ACTIONS = new Set<PermissionAction>([
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

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<PermissionAction>> = {
  OWNER: new Set<PermissionAction>([
    'audit:read',
    'billing:manage',
    'company:read',
    'company:update',
    'environment:read',
    'environment:write',
    'project:create',
    'project:delete',
    'project:read',
    'project:update',
    'run:read',
    'run:write',
    'secret:read',
    'secret:write',
    'suite:read',
    'suite:write',
    'team:manage',
    'token:manage',
  ]),
  ADMIN: new Set<PermissionAction>([
    'audit:read',
    'company:read',
    'company:update',
    'environment:read',
    'environment:write',
    'project:create',
    'project:delete',
    'project:read',
    'project:update',
    'run:read',
    'run:write',
    'secret:read',
    'secret:write',
    'suite:read',
    'suite:write',
    'team:manage',
    'token:manage',
  ]),
  DEVELOPER: new Set<PermissionAction>([
    'company:read',
    'environment:read',
    'environment:write',
    'project:read',
    'run:read',
    'run:write',
    'secret:read',
    'suite:read',
    'suite:write',
  ]),
  VIEWER: new Set<PermissionAction>([
    'company:read',
    'environment:read',
    'project:read',
    'run:read',
    'secret:read',
    'suite:read',
  ]),
};

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCan(
    principal: AuthenticatedPrincipal | undefined,
    action: PermissionAction,
    resource: ResolvedResource,
  ): Promise<void> {
    if (!principal) {
      throw new UnauthorizedException();
    }
    if (resource.companyId && principal.companyId !== resource.companyId) {
      throw new ForbiddenException('Resource belongs to another company');
    }
    if (principal.projectId && resource.projectId && principal.projectId !== resource.projectId) {
      throw new ForbiddenException('API token is not allowed for this project');
    }
    if (principal.projectId && !resource.projectId && action !== 'company:read') {
      throw new ForbiddenException('Project-scoped API token cannot access company-wide resources');
    }

    const role = await this.resolveEffectiveRole(principal, resource.projectId);
    if (!ROLE_PERMISSIONS[role].has(action)) {
      throw new ForbiddenException('Permission denied');
    }
    this.assertTokenScope(principal, action);
  }

  canRole(role: UserRole, action: PermissionAction): boolean {
    return ROLE_PERMISSIONS[role].has(action);
  }

  private async resolveEffectiveRole(
    principal: AuthenticatedPrincipal,
    projectId?: string,
  ): Promise<UserRole> {
    if (principal.type !== 'USER' || !principal.userId || !projectId) {
      return principal.role;
    }

    const projectMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: principal.userId } },
      select: { role: true },
    });
    if (!projectMember) {
      return principal.role;
    }
    return this.projectRoleToUserRole(projectMember.role);
  }

  private projectRoleToUserRole(role: ProjectRole): UserRole {
    if (role === 'ADMIN') {
      return 'ADMIN';
    }
    if (role === 'DEVELOPER') {
      return 'DEVELOPER';
    }
    return 'VIEWER';
  }

  private assertTokenScope(principal: AuthenticatedPrincipal, action: PermissionAction): void {
    if (principal.type !== 'API_TOKEN') {
      return;
    }
    if (!API_TOKEN_ALLOWED_ACTIONS.has(action)) {
      throw new ForbiddenException('API token cannot perform this action');
    }
    const scopes = principal.scopes ?? [];
    if (scopes.includes(action)) {
      return;
    }
    throw new ForbiddenException('API token scope denied');
  }
}
