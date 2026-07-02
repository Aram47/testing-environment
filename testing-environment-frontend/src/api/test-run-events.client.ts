import { io, Socket } from 'socket.io-client';
import type { TestRunEvent } from '../types';
import { tokenStorage } from '../lib/tokenStorage';

interface RunnerEventMessage extends TestRunEvent {
  testRunId: string;
}

export class TestRunEventsClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelay = 1000; // 1 second

  connect(runId: string, onEvent: (event: TestRunEvent) => void, onError: () => void): () => void {
    const baseUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost';
    const token = tokenStorage.getToken();

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
      // Subscribe to the test run after connection
      this.socket?.emit('subscribe', { testRunId: runId });
    });

    this.socket.on('runner.event', (event: RunnerEventMessage) => {
      if (event.testRunId !== runId) {
        return;
      }
      try {
        onEvent(event);
      } catch (err) {
        console.error('Error processing test event:', err);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error: unknown) => {
      console.error('WebSocket error:', error);
      onError();
    });

    this.socket.on('connect_error', (error: unknown) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        onError();
      }
    });

    return () => {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    };
  }
}
