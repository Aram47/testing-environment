import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

export interface RunnerEvent {
  type: string;
  runId: string;
  payload?: Record<string, unknown>;
}

export interface TestRunEventMessage {
  runId: string;
  sequence: number;
  type: string;
  timestamp: string;
  payload: unknown;
}

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly channel = 'runner-events';
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private server?: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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

  async emitRunEvent(event: RunnerEvent): Promise<TestRunEventMessage | null> {
    const message = await this.persistEvent(event);
    if (!message) {
      return null;
    }
    if (this.server) {
      this.emitToSocket(message);
      return message;
    }
    void this.publish(message);
    return message;
  }

  disconnectUser(userId: string): void {
    this.disconnectRoom(this.userRoom(userId));
  }

  disconnectApiToken(apiTokenId: string): void {
    this.disconnectRoom(this.apiTokenRoom(apiTokenId));
  }

  private disconnectRoom(room: string): void {
    const sockets = this.server?.sockets.adapter.rooms.get(room);
    if (!sockets) {
      return;
    }
    for (const socketId of sockets) {
      this.server?.sockets.sockets.get(socketId)?.disconnect(true);
    }
  }

  userRoom(userId: string): string {
    return `user:${userId}`;
  }

  companyRoom(companyId: string): string {
    return `company:${companyId}`;
  }

  apiTokenRoom(apiTokenId: string): string {
    return `api-token:${apiTokenId}`;
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
          this.emitToSocket(JSON.parse(payload) as TestRunEventMessage);
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

  private async publish(message: TestRunEventMessage): Promise<void> {
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

  private emitToSocket(message: TestRunEventMessage): void {
    this.server?.to(message.runId).emit('runner.event', message);
  }

  private async persistEvent(event: RunnerEvent): Promise<TestRunEventMessage | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const run = await tx.testRun.update({
          where: { id: event.runId },
          data: { eventSequence: { increment: 1 } },
          select: { eventSequence: true },
        });
        const timestamp = new Date();
        const payload = this.toJsonPayload(event.payload);
        const created = await tx.testRunEvent.create({
          data: {
            runId: event.runId,
            sequence: run.eventSequence,
            type: event.type,
            timestamp,
            payload,
          },
        });
        return {
          runId: created.runId,
          sequence: created.sequence,
          type: created.type,
          timestamp: created.timestamp.toISOString(),
          payload: created.payload,
        };
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist realtime event for run ${event.runId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private toJsonPayload(payload: Record<string, unknown> | undefined): Prisma.InputJsonValue {
    return (payload ?? {}) as Prisma.InputJsonValue;
  }
}
