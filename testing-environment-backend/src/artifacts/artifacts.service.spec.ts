import { ArtifactCompression, ArtifactType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArtifactStorage } from './artifact-storage.interface';
import { ArtifactsService } from './artifacts.service';

describe('ArtifactsService', () => {
  it('upserts artifacts by object key for idempotent writers', async () => {
    const storage = {
      put: jest.fn(() =>
        Promise.resolve({
          objectKey: 'runs/run-1/responses/step-1.json.gz',
          byteSize: 32,
          checksum: 'checksum',
        }),
      ),
    };
    const prisma = {
      artifact: {
        upsert: jest.fn(() => Promise.resolve({ id: 'artifact-1' })),
      },
    };
    const service = new ArtifactsService(
      prisma as unknown as PrismaService,
      storage as unknown as ArtifactStorage,
    );

    await service.putOrReplace({
      testRunId: 'run-1',
      stepId: 'step-1',
      type: ArtifactType.RESPONSE_BODY,
      objectKey: 'runs/run-1/responses/step-1.json.gz',
      mimeType: 'application/json',
      data: Buffer.from('{"ok":true}', 'utf8'),
      compression: ArtifactCompression.GZIP,
      retentionUntil: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(storage.put).toHaveBeenCalledWith({
      objectKey: 'runs/run-1/responses/step-1.json.gz',
      data: expect.any(Buffer),
    });
    expect(prisma.artifact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { objectKey: 'runs/run-1/responses/step-1.json.gz' },
      }),
    );
  });
});
