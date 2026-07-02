import { Injectable } from '@nestjs/common';
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
export class RealtimeService {
  private server?: Server;

  bind(server: Server): void {
    this.server = server;
  }

  emitRunEvent(event: RunnerEvent): void {
    const message: RunnerEventMessage = {
      ...event,
      message: this.toMessage(event),
      timestamp: new Date().toISOString(),
    };
    this.server?.to(event.testRunId).emit('runner.event', message);
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
