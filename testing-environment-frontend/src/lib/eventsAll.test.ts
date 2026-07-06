import { describe, expect, it } from 'vitest';
import { shouldApplyTestRunEvent } from './testRunEvent';

describe('eventsAll pagination logic', () => {
  it('stops when a page is smaller than the backend page size', () => {
    const pageSize = 500;
    const allEvents = Array.from({ length: 750 }, (_, index) => ({
      runId: 'run-1',
      sequence: index + 1,
      type: 'logs.updated',
      timestamp: '2026-07-06T10:00:00.000Z',
      payload: {},
    }));

    const fetchPage = (afterSequence: number) =>
      allEvents.filter((event) => event.sequence > afterSequence).slice(0, pageSize);

    const collected = [];
    let cursor = 0;
    while (true) {
      const page = fetchPage(cursor);
      if (!page.length) {
        break;
      }
      collected.push(...page);
      cursor = page[page.length - 1].sequence;
      if (page.length < pageSize) {
        break;
      }
    }

    expect(collected).toHaveLength(750);
    expect(collected[collected.length - 1]?.sequence).toBe(750);
  });
});

describe('shouldApplyTestRunEvent', () => {
  it('deduplicates by sequence', () => {
    const seen = new Set<number>();
    expect(shouldApplyTestRunEvent(seen, 1)).toBe(true);
    expect(shouldApplyTestRunEvent(seen, 1)).toBe(false);
  });
});
