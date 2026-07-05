import { RunnerLogSource } from '@prisma/client';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ArtifactLogWriterService } from './artifact-log-writer.service';
import { ArtifactsService } from './artifacts.service';

describe('ArtifactLogWriterService', () => {
  it('enforces total log limit and stores chunk metadata', async () => {
    const createdChunks: unknown[] = [];
    const prisma = {
      runnerLogChunk: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { byteSize: 0 } })),
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(({ data }) => {
          const chunk = {
            id: `chunk-${createdChunks.length + 1}`,
            createdAt: new Date('2026-07-05T00:00:00.000Z'),
            ...data,
          };
          createdChunks.push(chunk);
          return Promise.resolve(chunk);
        }),
        findMany: jest.fn(() => Promise.resolve(createdChunks)),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
    };
    const artifacts = {
      totalLogLimitBytes: jest.fn(() => 5),
      previewLimitBytes: jest.fn(() => 100),
      retentionUntil: jest.fn(() => new Date('2026-08-01T00:00:00.000Z')),
      putOrReplace: jest.fn(() => Promise.resolve({ id: 'artifact-1' })),
    };
    const service = new ArtifactLogWriterService(
      prisma as unknown as PrismaService,
      artifacts as unknown as ArtifactsService,
      { incrementLogBytes: jest.fn() } as unknown as MetricsService,
    );

    await service.append('run-1', RunnerLogSource.DOCKER, '1234567890');

    expect(prisma.runnerLogChunk.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        preview: '12345',
        byteSize: 5,
        truncated: true,
      }),
    });
    expect(artifacts.putOrReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: 'runs/run-1/logs/docker/compose.log.gz',
      }),
    );
  });

  it('does not append repeated empty chunks after the total log limit marker exists', async () => {
    const prisma = {
      runnerLogChunk: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { byteSize: 5 } })),
        findFirst: jest.fn(() => Promise.resolve({ byteSize: 0, truncated: true })),
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const service = new ArtifactLogWriterService(
      prisma as unknown as PrismaService,
      {
        totalLogLimitBytes: jest.fn(() => 5),
        previewLimitBytes: jest.fn(() => 100),
      } as unknown as ArtifactsService,
      { incrementLogBytes: jest.fn() } as unknown as MetricsService,
    );

    await service.append('run-1', RunnerLogSource.DOCKER, 'more logs');

    expect(prisma.runnerLogChunk.create).not.toHaveBeenCalled();
  });

  it('keeps system-like sources in one ndjson artifact without dropping existing chunks', async () => {
    const chunks = [
      {
        id: 'chunk-1',
        testRunId: 'run-1',
        source: RunnerLogSource.SYSTEM,
        sequence: 1,
        preview: 'started',
        byteSize: 7,
        truncated: false,
        createdAt: new Date('2026-07-05T00:00:00.000Z'),
      },
      {
        id: 'chunk-2',
        testRunId: 'run-1',
        source: RunnerLogSource.ERROR,
        sequence: 1,
        preview: 'failed',
        byteSize: 6,
        truncated: false,
        createdAt: new Date('2026-07-05T00:00:01.000Z'),
      },
    ];
    const prisma = {
      runnerLogChunk: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { byteSize: 7 } })),
        findFirst: jest.fn(() => Promise.resolve({ sequence: 1 })),
        create: jest.fn(({ data }) => Promise.resolve({ ...chunks[1], ...data })),
        findMany: jest.fn(() => Promise.resolve(chunks)),
        updateMany: jest.fn(() => Promise.resolve({ count: 2 })),
      },
    };
    const putOrReplace: jest.Mock = jest.fn(() => Promise.resolve({ id: 'artifact-1' }));
    const artifacts = {
      totalLogLimitBytes: jest.fn(() => 100),
      previewLimitBytes: jest.fn(() => 100),
      retentionUntil: jest.fn(() => new Date('2026-08-01T00:00:00.000Z')),
      putOrReplace,
    };
    const service = new ArtifactLogWriterService(
      prisma as unknown as PrismaService,
      artifacts as unknown as ArtifactsService,
      { incrementLogBytes: jest.fn() } as unknown as MetricsService,
    );

    await service.append('run-1', RunnerLogSource.ERROR, 'failed');

    expect(prisma.runnerLogChunk.findMany).toHaveBeenCalledWith({
      where: { testRunId: 'run-1', source: { not: RunnerLogSource.DOCKER } },
      orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }],
    });
    const artifactInput = putOrReplace.mock.calls[0]?.[0] as
      { objectKey: string; data: Buffer } | undefined;
    if (!artifactInput) {
      throw new Error('Expected artifact input');
    }
    expect(artifactInput.objectKey).toBe('runs/run-1/logs/system.ndjson.gz');
    expect(artifactInput.data.toString('utf8')).toContain('"message":"started"');
    expect(artifactInput.data.toString('utf8')).toContain('"message":"failed"');
  });
});
