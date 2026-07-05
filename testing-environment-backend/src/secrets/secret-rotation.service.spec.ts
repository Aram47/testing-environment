import { SecretRotationJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecretCryptoService } from './secret-crypto.service';
import { SecretRotationService } from './secret-rotation.service';

describe('SecretRotationService', () => {
  it('creates a durable rotation job for the first outdated key version', async () => {
    const prisma = {
      secret: {
        findMany: jest.fn(() => Promise.resolve([{ encryptionKeyVersion: 'v1' }])),
        count: jest.fn(() => Promise.resolve(2)),
      },
      secretRotationJob: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn((input) => Promise.resolve({ id: 'rotation-1', ...input.data })),
      },
    };
    const queue = { add: jest.fn(() => Promise.resolve()) };
    const service = new SecretRotationService(
      prisma as unknown as PrismaService,
      { getActiveKeyVersion: jest.fn(() => 'v2') } as unknown as SecretCryptoService,
      queue as never,
    );

    await service.enqueue('company-1', 'user-1');

    expect(prisma.secret.findMany).toHaveBeenCalledWith({
      where: { encryptionKeyVersion: { not: 'v2' }, project: { companyId: 'company-1' } },
      distinct: ['encryptionKeyVersion'],
      select: { encryptionKeyVersion: true },
      orderBy: { encryptionKeyVersion: 'asc' },
    });

    expect(prisma.secretRotationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        fromKeyVersion: 'v1',
        toKeyVersion: 'v2',
        actorUserId: 'user-1',
        totalSecrets: 2,
      }),
    });
    expect(queue.add).toHaveBeenCalledWith(
      'rotate-secret-key',
      { rotationJobId: 'rotation-1' },
      { jobId: 'secret-rotation:rotation-1' },
    );
  });

  it('re-encrypts outdated secrets and records progress transactionally', async () => {
    const tx = {
      secret: { update: jest.fn(() => Promise.resolve()) },
      auditEvent: { create: jest.fn(() => Promise.resolve()) },
      secretRotationJob: { update: jest.fn(() => Promise.resolve()) },
    };
    const prisma = {
      secretRotationJob: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: 'rotation-1',
            status: SecretRotationJobStatus.PENDING,
            fromKeyVersion: 'v1',
            toKeyVersion: 'v2',
            companyId: 'company-1',
            processedSecrets: 0,
            lastProcessedSecretId: null,
            actorUserId: 'user-1',
            startedAt: null,
          }),
        ),
        update: jest.fn(() => Promise.resolve()),
      },
      secret: {
        count: jest.fn(() => Promise.resolve(1)),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'secret-1',
              projectId: 'project-1',
              key: 'API_KEY',
              encryptedValue: 'old',
              encryptionKeyVersion: 'v1',
            },
          ])
          .mockResolvedValueOnce([]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const crypto = {
      decrypt: jest.fn(() => 'plain'),
      encrypt: jest.fn(() => 'new'),
      getActiveKeyVersion: jest.fn(() => 'v2'),
    };
    const service = new SecretRotationService(
      prisma as unknown as PrismaService,
      crypto as unknown as SecretCryptoService,
      { add: jest.fn() } as never,
    );

    await service.process('rotation-1');

    expect(prisma.secret.findMany).toHaveBeenCalledWith({
      where: {
        encryptionKeyVersion: 'v1',
        project: { companyId: 'company-1' },
      },
      orderBy: { id: 'asc' },
      take: 50,
    });

    expect(tx.secret.update).toHaveBeenCalledWith({
      where: { id: 'secret-1' },
      data: expect.objectContaining({
        encryptedValue: 'new',
        encryptionKeyVersion: 'v2',
        rotatedAt: expect.any(Date),
      }),
    });
    expect(tx.secretRotationJob.update).toHaveBeenCalledWith({
      where: { id: 'rotation-1' },
      data: { processedSecrets: 1, lastProcessedSecretId: 'secret-1' },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: 'company-1' }),
    });
    expect(prisma.secretRotationJob.update).toHaveBeenLastCalledWith({
      where: { id: 'rotation-1' },
      data: expect.objectContaining({ status: SecretRotationJobStatus.COMPLETED }),
    });
  });
});
