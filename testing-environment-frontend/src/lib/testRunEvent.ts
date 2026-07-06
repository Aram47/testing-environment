import type { TestRunEvent } from '../types';

export function testRunEventMessage(event: TestRunEvent): string {
  const payload = event.payload;
  if (payload && typeof payload === 'object') {
    if ('message' in payload && payload.message != null) {
      return String(payload.message);
    }
    if ('testName' in payload && payload.testName != null) {
      return String(payload.testName);
    }
  }
  if (payload == null) {
    return event.type;
  }
  return JSON.stringify(payload);
}

export function shouldApplyTestRunEvent(seenSequences: Set<number>, sequence: number): boolean {
  if (seenSequences.has(sequence)) {
    return false;
  }
  seenSequences.add(sequence);
  return true;
}
