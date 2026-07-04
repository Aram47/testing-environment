import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Server } from 'socket.io';

export interface RunnerEvent {
  type: string;
  testRunId: string;
  payload?: Record<string, unknown>;
}

export interface RunnerEventMessage extends RunnerEvent {
  message: string;
  timestamp: string;
}

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly channel = 'runner-events';
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private server?: Server;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.publisher = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    this.subscriber = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  }

  bind(server: Server): void {
    this.server = server;
    void this.subscribe();
  }

  emitRunEvent(event: RunnerEvent): void {
    const message: RunnerEventMessage = {
      ...event,
      message: this.toMessage(event),
      timestamp: new Date().toISOString(),
    };
    if (this.server) {
      this.emitToSocket(message);
      return;
    }
    void this.publish(message);
  }

  async onModuleDestroy(): Promise<void> {
    this.publisher.disconnect();
    this.subscriber.disconnect();
  }

  private async subscribe(): Promise<void> {
    try {
      if (this.subscriber.status === 'wait') {
        await this.subscriber.connect();
      }
      this.subscriber.on('message', (_channel, payload) => {
        try {
          this.emitToSocket(JSON.parse(payload) as RunnerEventMessage);
        } catch (error) {
          this.logger.warn(
            `Failed to handle realtime payload: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
      await this.subscriber.subscribe(this.channel);
    } catch (error) {
      this.logger.warn(
        `Redis realtime subscriber is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async publish(message: RunnerEventMessage): Promise<void> {
    try {
      if (this.publisher.status === 'wait') {
        await this.publisher.connect();
      }
      await this.publisher.publish(this.channel, JSON.stringify(message));
    } catch (error) {
      this.logger.warn(
        `Redis realtime publisher is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private emitToSocket(message: RunnerEventMessage): void {
    this.server?.to(message.testRunId).emit('runner.event', message);
  }

  private toMessage(event: RunnerEvent): string {
    const suiteName = event.payload?.suiteName;
    const testName = event.payload?.testName;
    const errorMessage = event.payload?.errorMessage;

    switch (event.type) {
      case 'run.started':
        return 'Test run started';
      case 'environment.starting':
        return 'Starting docker compose environment';
      case 'environment.ready':
        return 'Environment is ready';
      case 'test.started':
        return `Started ${String(suiteName ?? 'suite')} / ${String(testName ?? 'test')}`;
      case 'test.passed':
        return `Passed ${String(suiteName ?? 'suite')} / ${String(testName ?? 'test')}`;
      case 'test.failed':
        return `Failed ${String(suiteName ?? 'suite')} / ${String(testName ?? 'test')}${errorMessage ? `: ${String(errorMessage)}` : ''}`;
      case 'logs.updated':
        return 'Docker logs updated';
      case 'environment.stopping':
        return 'Stopping docker compose environment';
      case 'run.finished':
        return 'Test run finished';
      default:
        return event.type;
    }
  }
}
