import { io, Socket } from 'socket.io-client';
import type { TestRunEvent } from '../types';
import { tokenStorage } from '../lib/tokenStorage';
import { testRunsApi } from './test-runs.api';

interface LegacyRunnerEventMessage extends Partial<TestRunEvent> {
  testRunId: string;
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

interface TestRunEventsHandlers {
  onEvent: (event: TestRunEvent) => void;
  onConnectionState: (state: ConnectionState) => void;
  onError: () => void;
}

export class TestRunEventsClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelay = 1000; // 1 second
  private lastSequence = 0;
  private readonly seenSequences = new Set<number>();

  connect(projectId: string, runId: string, handlers: TestRunEventsHandlers): () => void {
    const baseUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost';
    const token = tokenStorage.getToken();
    handlers.onConnectionState('connecting');

    // Connect to the /runs namespace where backend WebSocket gateway is listening
    // Note: namespace is part of the URL, not a separate option in socket.io-client
    this.socket = io(`${baseUrl}/runs`, {
      path: '/socket.io/',
      auth: {
        token: token || '',
      },
      reconnection: true,
      reconnectionDelay: this.baseReconnectDelay,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      handlers.onConnectionState('connected');
      // Subscribe to the test run after connection
      this.socket?.emit('subscribe', { testRunId: runId });
      void this.recover(projectId, runId, handlers.onEvent, handlers.onError);
    });

    this.socket.io.on('reconnect_attempt', () => {
      handlers.onConnectionState('reconnecting');
    });

    this.socket.on('runner.event', (event: TestRunEvent | LegacyRunnerEventMessage) => {
      const normalized = this.normalizeEvent(runId, event);
      if (!normalized || normalized.runId !== runId) {
        return;
      }
      try {
        this.applyOnce(normalized, handlers.onEvent);
      } catch (err) {
        console.error('Error processing test event:', err);
      }
    });

    this.socket.on('disconnect', () => {
      handlers.onConnectionState('disconnected');
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error: unknown) => {
      console.error('WebSocket error:', error);
      handlers.onConnectionState('error');
      handlers.onError();
    });

    this.socket.on('connect_error', (error: unknown) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        handlers.onConnectionState('error');
        handlers.onError();
      } else {
        handlers.onConnectionState('reconnecting');
      }
    });

    return () => {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    };
  }

  private async recover(
    projectId: string,
    runId: string,
    onEvent: (event: TestRunEvent) => void,
    onError: () => void,
  ): Promise<void> {
    try {
      const missedEvents = await testRunsApi.events(projectId, runId, this.lastSequence);
      for (const event of missedEvents) {
        this.applyOnce(event, onEvent);
      }
    } catch (error) {
      console.error('Failed to recover test run events:', error);
      onError();
    }
  }

  private applyOnce(event: TestRunEvent, onEvent: (event: TestRunEvent) => void): void {
    if (this.seenSequences.has(event.sequence)) {
      return;
    }
    this.seenSequences.add(event.sequence);
    this.lastSequence = Math.max(this.lastSequence, event.sequence);
    onEvent(event);
  }

  private normalizeEvent(runId: string, event: TestRunEvent | LegacyRunnerEventMessage): TestRunEvent | null {
    if ('runId' in event && typeof event.runId === 'string' && typeof event.sequence === 'number') {
      return {
        runId: event.runId,
        sequence: event.sequence,
        type: String(event.type),
        timestamp: String(event.timestamp),
        payload: event.payload ?? {},
      };
    }
    if ('testRunId' in event && event.testRunId === runId && typeof event.timestamp === 'string') {
      return {
        runId,
        sequence: Number(event.sequence ?? Date.now()),
        type: String(event.type),
        timestamp: event.timestamp,
        payload: event.payload ?? {},
      };
    }
    return null;
  }
}
