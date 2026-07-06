import { describe, expect, it } from 'vitest';
import { shouldApplyTestRunEvent, testRunEventMessage } from './testRunEvent';
import type { TestRunEvent } from '../types';

describe('testRunEvent helpers', () => {
  it('extracts message from payload', () => {
    const event: TestRunEvent = {
      runId: 'run-1',
      sequence: 1,
      type: 'logs.updated',
      timestamp: '2026-07-06T10:00:00.000Z',
      payload: { message: 'Container started' },
    };

    expect(testRunEventMessage(event)).toBe('Container started');
  });

  it('deduplicates events by sequence', () => {
    const seen = new Set<number>();

    expect(shouldApplyTestRunEvent(seen, 10)).toBe(true);
    expect(shouldApplyTestRunEvent(seen, 10)).toBe(false);
    expect(shouldApplyTestRunEvent(seen, 11)).toBe(true);
  });
});
