import { SetMetadata } from '@nestjs/common';
import { PermissionAction, ResourceType, RequiredPermission } from '../permission.types';

export const PERMISSION_KEY = 'requiredPermission';

export function RequirePermission(
  action: PermissionAction,
  resourceType?: ResourceType,
): ReturnType<typeof SetMetadata> {
  return SetMetadata(PERMISSION_KEY, { action, resourceType } satisfies RequiredPermission);
}
