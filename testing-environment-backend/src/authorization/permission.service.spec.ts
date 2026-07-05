import { ForbiddenException } from '@nestjs/common';
import { PrincipalType } from '@prisma/client';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  const prisma = {
    projectMember: { findUnique: jest.fn() },
  };
  const service = new PermissionService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.projectMember.findUnique.mockResolvedValue(null);
  });

  it('allows developers to write environments', async () => {
    await expect(
      service.assertCan(
        {
          type: PrincipalType.USER,
          id: 'user-1',
          userId: 'user-1',
          email: 'dev@example.com',
          companyId: 'company-1',
          role: 'DEVELOPER',
        },
        'environment:write',
        { type: 'environment', projectId: 'project-1', companyId: 'company-1' },
      ),
    ).resolves.toBeUndefined();
  });

  it('denies viewers from starting runs', async () => {
    await expect(
      service.assertCan(
        {
          type: PrincipalType.USER,
          id: 'user-1',
          userId: 'user-1',
          email: 'viewer@example.com',
          companyId: 'company-1',
          role: 'VIEWER',
        },
        'run:write',
        { type: 'run', projectId: 'project-1', companyId: 'company-1' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies API token scopes and project bounds', async () => {
    await expect(
      service.assertCan(
        {
          type: PrincipalType.API_TOKEN,
          id: 'token-1',
          email: 'token',
          companyId: 'company-1',
          role: 'OWNER',
          apiTokenId: 'token-1',
          scopes: ['run:read'],
          projectId: 'project-1',
        },
        'run:write',
        { type: 'run', projectId: 'project-1', companyId: 'company-1' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.assertCan(
        {
          type: PrincipalType.API_TOKEN,
          id: 'token-1',
          email: 'token',
          companyId: 'company-1',
          role: 'OWNER',
          apiTokenId: 'token-1',
          scopes: ['run:read'],
          projectId: 'project-1',
        },
        'run:read',
        { type: 'run', projectId: 'project-2', companyId: 'company-1' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
