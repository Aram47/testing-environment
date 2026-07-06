import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TestRunEventsClient, type ConnectionState } from '../test-run-events.client';
import { testRunsApi } from '../test-runs.api';
import { RingBuffer } from '../../lib/RingBuffer';
import { shouldApplyTestRunEvent } from '../../lib/testRunEvent';
import type { TestRunEvent } from '../../types';

const EVENT_BUFFER_CAPACITY = 500;

export function useTestRunEvents(projectId: string, runId: string) {
  const [events, setEvents] = useState<TestRunEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSequence, setLastSequence] = useState(0);
  const bufferRef = useRef(new RingBuffer<TestRunEvent>(EVENT_BUFFER_CAPACITY));
  const seenSequencesRef = useRef(new Set<number>());
  const lastSequenceRef = useRef(0);

  const applyEvent = useCallback((event: TestRunEvent) => {
    if (!shouldApplyTestRunEvent(seenSequencesRef.current, event.sequence)) {
      return;
    }
    lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence);
    setLastSequence(lastSequenceRef.current);
    setEvents(bufferRef.current.push(event));
  }, []);

  useEffect(() => {
    if (!projectId || !runId) {
      return undefined;
    }

    let cancelled = false;
    let disconnect: (() => void) | undefined;
    const client = new TestRunEventsClient();
    bufferRef.current = new RingBuffer<TestRunEvent>(EVENT_BUFFER_CAPACITY);
    seenSequencesRef.current = new Set<number>();
    lastSequenceRef.current = 0;
    setEvents([]);
    setLastSequence(0);
    setConnectionState('connecting');

    const start = async () => {
      try {
        const history = await testRunsApi.eventsAll(projectId, runId, 0);
        if (cancelled) {
          return;
        }
        for (const event of history) {
          applyEvent(event);
        }
      } catch (error) {
        console.error('Failed to load test run event history:', error);
        if (!cancelled) {
          setConnectionState('error');
        }
      }

      if (cancelled) {
        return;
      }

      client.seedRecoveryState(lastSequenceRef.current, seenSequencesRef.current);
      disconnect = client.connect(projectId, runId, {
        onEvent: applyEvent,
        onConnectionState: setConnectionState,
        onError: () => setConnectionState('error'),
      });
    };

    void start();

    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [applyEvent, projectId, runId]);

  return useMemo(
    () => ({
      events,
      connectionState,
      lastSequence,
    }),
    [connectionState, events, lastSequence],
  );
}
