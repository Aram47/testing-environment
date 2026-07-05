import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { DockerHealthService } from './docker-health.service';

export interface ReadinessResult {
  status: 'ok' | 'error';
  checks: {
    postgres: 'ok' | 'error';
    redis: 'ok' | 'error';
    docker?: 'ok' | 'error';
  };
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly docker: DockerHealthService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: true,
      connectTimeout: 1000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  }

  async ready(): Promise<ReadinessResult> {
    const checks = {
      postgres: await this.checkPostgres(),
      redis: await this.checkRedis(),
      ...(this.config.get<string>('APP_ROLE') === 'worker'
        ? { docker: await this.docker.check() }
        : {}),
    };
    const ok = Object.values(checks).every((status) => status === 'ok');
    return {
      status: ok ? 'ok' : 'error',
      checks,
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }

  private async checkPostgres(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<'ok' | 'error'> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      const response = await this.redis.ping();
      return response === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
