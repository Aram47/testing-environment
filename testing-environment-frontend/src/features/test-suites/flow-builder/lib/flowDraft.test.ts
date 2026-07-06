import { describe, expect, it } from 'vitest';
import { createApiNode } from './flowNodeFactory';
import { shouldOfferDraftRestore } from './flowDraft';
import type { FlowSuiteDefinition } from '../../../../types';

const baseFlow = (): FlowSuiteDefinition => ({
  version: '1.1',
  suiteName: 'Test',
  nodes: [createApiNode(1, { id: 'api-1', name: 'Health' })],
  edges: [],
});

describe('shouldOfferDraftRestore', () => {
  it('returns false when draft matches current flow', () => {
    const flow = baseFlow();
    expect(shouldOfferDraftRestore({ flow, savedAt: Date.now() }, flow)).toBe(false);
  });

  it('returns true when draft differs from current flow', () => {
    const flow = baseFlow();
    const draft = {
      ...flow,
      nodes: [createApiNode(1, { id: 'api-1', name: 'Changed' })],
    };
    expect(shouldOfferDraftRestore({ flow: draft, savedAt: Date.now() }, flow)).toBe(true);
  });
});
