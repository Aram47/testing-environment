import { Global, Module } from '@nestjs/common';
import { ApiTokenAuthService } from './api-token-auth.service';
import { PermissionService } from './permission.service';
import { PermissionsGuard } from './permissions.guard';
import { ResourceResolverService } from './resource-resolver.service';

@Global()
@Module({
  providers: [ApiTokenAuthService, PermissionService, PermissionsGuard, ResourceResolverService],
  exports: [ApiTokenAuthService, PermissionService, PermissionsGuard, ResourceResolverService],
})
export class AuthorizationModule {}
