export type PermissionAction =
  | 'audit:read'
  | 'billing:manage'
  | 'company:read'
  | 'company:update'
  | 'environment:read'
  | 'environment:write'
  | 'project:create'
  | 'project:delete'
  | 'project:read'
  | 'project:update'
  | 'run:read'
  | 'run:write'
  | 'secret:read'
  | 'secret:write'
  | 'suite:read'
  | 'suite:write'
  | 'team:manage'
  | 'token:manage';

export type ResourceType =
  | 'auditEvent'
  | 'company'
  | 'environment'
  | 'project'
  | 'run'
  | 'secret'
  | 'suite'
  | 'revision'
  | 'team'
  | 'token';

export interface RequiredPermission {
  action: PermissionAction;
  resourceType?: ResourceType;
}

export interface ResolvedResource {
  type: ResourceType;
  id?: string;
  companyId?: string;
  projectId?: string;
}
