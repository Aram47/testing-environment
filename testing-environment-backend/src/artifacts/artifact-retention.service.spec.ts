import { PrismaService } from '../prisma/prisma.service';
import { ArtifactRetentionService } from './artifact-retention.service';
import { ArtifactsService } from './artifacts.service';

describe('ArtifactRetentionService', () => {
  it('deletes expired artifacts and leaves active artifacts untouched', async () => {
    const expired = {
      id: 'artifact-expired',
      objectKey: 'runs/run-1/report.json',
      retentionUntil: new Date('2026-07-01T00:00:00.000Z'),
    };
    const prisma = {
      artifact: {
        findMany: jest.fn(() => Promise.resolve([expired])),
        delete: jest.fn(() => Promise.resolve(expired)),
      },
      runnerLogChunk: {
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      testResult: {
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const artifacts = { deleteObject: jest.fn(() => Promise.resolve()) };
    const service = new ArtifactRetentionService(
      prisma as unknown as PrismaService,
      artifacts as unknown as ArtifactsService,
      { add: jest.fn() } as never,
    );

    await expect(service.cleanupExpired(new Date('2026-07-05T00:00:00.000Z'))).resolves.toBe(1);

    expect(prisma.artifact.findMany).toHaveBeenCalledWith({
      where: { retentionUntil: { lt: new Date('2026-07-05T00:00:00.000Z') } },
      take: 100,
    });
    expect(artifacts.deleteObject).toHaveBeenCalledWith('runs/run-1/report.json');
    expect(prisma.artifact.delete).toHaveBeenCalledWith({ where: { id: 'artifact-expired' } });
  });
});
