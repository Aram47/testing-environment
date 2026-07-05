import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DockerHealthService } from './docker-health.service';
import { HealthService } from './health.service';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    status: 'wait',
    connect: jest.fn(() => Promise.resolve()),
    ping: jest.fn(() => Promise.resolve('PONG')),
    disconnect: jest.fn(),
  })),
}));

describe('HealthService', () => {
  it('checks PostgreSQL and Redis for API readiness', async () => {
    const service = new HealthService(
      config('api'),
      { $queryRaw: jest.fn(() => Promise.resolve([{ ok: 1 }])) } as unknown as PrismaService,
      { check: jest.fn() } as unknown as DockerHealthService,
    );

    await expect(service.ready()).resolves.toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok' },
    });

    await service.onModuleDestroy();
  });

  it('includes Docker access for worker readiness', async () => {
    const docker = { check: jest.fn(() => Promise.resolve('error')) };
    const service = new HealthService(
      config('worker'),
      { $queryRaw: jest.fn(() => Promise.resolve([{ ok: 1 }])) } as unknown as PrismaService,
      docker as unknown as DockerHealthService,
    );

    await expect(service.ready()).resolves.toEqual({
      status: 'error',
      checks: { postgres: 'ok', redis: 'ok', docker: 'error' },
    });

    await service.onModuleDestroy();
  });
});

function config(role: 'api' | 'worker'): ConfigService {
  return {
    get: jest.fn((key: string, fallback: unknown) => {
      if (key === 'APP_ROLE') {
        return role;
      }
      if (key === 'REDIS_URL') {
        return 'redis://localhost:6379';
      }
      return fallback;
    }),
  } as unknown as ConfigService;
}
