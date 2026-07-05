import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { SecretAuditService } from './secret-audit.service';
import { SecretCryptoService } from './secret-crypto.service';
import { SecretsService } from './secrets.service';

describe('SecretsService', () => {
  it('creates a secret and returns metadata without plaintext or encrypted value', async () => {
    const tx = {
      secret: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(() =>
          Promise.resolve({
            id: 'secret-1',
            projectId: 'project-1',
            key: 'API_KEY',
            encryptedValue: 'encrypted',
            encryptionKeyVersion: 'v2',
            lastUsedAt: null,
            createdById: 'user-1',
            rotatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const audit = { record: jest.fn(() => Promise.resolve()) };
    const service = createService(prisma, audit);

    const result = await service.create('project-1', 'company-1', 'user-1', {
      key: 'API_KEY',
      value: 'plain-secret',
    });

    expect(result).not.toHaveProperty('encryptedValue');
    expect(JSON.stringify(result)).not.toContain('plain-secret');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'secret.created', resourceId: 'secret-1' }),
    );
  });

  it('rotates an existing secret value and writes a rotation audit event', async () => {
    const tx = {
      secret: {
        findUnique: jest.fn(() => Promise.resolve({ id: 'secret-1' })),
        update: jest.fn(() =>
          Promise.resolve({
            id: 'secret-1',
            projectId: 'project-1',
            key: 'API_KEY',
            encryptedValue: 'encrypted-v2',
            encryptionKeyVersion: 'v2',
            lastUsedAt: null,
            createdById: 'user-1',
            rotatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const audit = { record: jest.fn(() => Promise.resolve()) };
    const service = createService(prisma, audit);

    await service.create('project-1', 'company-1', 'user-1', {
      key: 'API_KEY',
      value: 'new-secret',
    });

    expect(tx.secret.update).toHaveBeenCalledWith({
      where: { id: 'secret-1' },
      data: expect.objectContaining({
        encryptedValue: 'encrypted:new-secret:v2',
        encryptionKeyVersion: 'v2',
        rotatedAt: expect.any(Date),
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'secret.rotated', resourceId: 'secret-1' }),
    );
  });
});

function createService(prisma: unknown, audit: unknown): SecretsService {
  return new SecretsService(
    prisma as PrismaService,
    {
      getProjectOrThrow: jest.fn(() => Promise.resolve({ id: 'project-1' })),
    } as unknown as ProjectAccessService,
    {
      encrypt: jest.fn((value: string, version?: string) => `encrypted:${value}:${version}`),
      getActiveKeyVersion: jest.fn(() => 'v2'),
    } as unknown as SecretCryptoService,
    audit as SecretAuditService,
  );
}
