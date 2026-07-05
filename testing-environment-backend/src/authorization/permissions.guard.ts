import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedPrincipal } from '../common/types/authenticated-user.type';
import { PERMISSION_KEY } from './decorators/require-permission.decorator';
import { PermissionService } from './permission.service';
import { RequiredPermission } from './permission.types';
import { ResourceResolverService } from './resource-resolver.service';

type PrincipalRequest = Request & {
  user?: AuthenticatedPrincipal;
  params: Record<string, string | undefined>;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
    private readonly resources: ResourceResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    const resource = await this.resources.resolve(request, permission);
    await this.permissions.assertCan(request.user, permission.action, resource);
    return true;
  }
}
