import { UnauthorizedException } from '@nestjs/common';
import { ApiTokenAuthService } from './api-token-auth.service';

describe('ApiTokenAuthService', () => {
  const prisma = {
    apiToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new ApiTokenAuthService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hashes tokens without returning raw token material', () => {
    expect(service.hash('raw-token')).toHaveLength(64);
    expect(service.hash('raw-token')).not.toContain('raw-token');
  });

  it('rejects revoked tokens', async () => {
    prisma.apiToken.findUnique.mockResolvedValue({
      id: 'token-1',
      companyId: 'company-1',
      name: 'Token',
      scopes: ['run:read'],
      projectId: null,
      serviceAccountId: null,
      serviceAccount: null,
      revokedAt: new Date(),
      expiresAt: null,
    });

    await expect(service.validate('raw-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.apiToken.update).not.toHaveBeenCalled();
  });
});
