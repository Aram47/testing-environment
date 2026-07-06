import { describe, expect, it } from 'vitest';
import type { FlowSuiteDefinition } from '../../../../types';
import { validateFlow } from './flowValidation';

const baseFlow = (overrides?: Partial<FlowSuiteDefinition>): FlowSuiteDefinition => ({
  version: '1.1',
  suiteName: 'Test',
  nodes: [
    {
      id: 'api-1',
      type: 'apiRequest',
      version: 'apiRequest/v1',
      position: { x: 0, y: 0 },
      name: 'Health',
      method: 'GET',
      path: '/health',
      expectStatus: 200,
      timeoutMs: 30000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
      continueOnFailure: false,
    },
  ],
  edges: [],
  ...overrides,
});

describe('validateFlow', () => {
  it('returns empty for valid flow', () => {
    expect(validateFlow(baseFlow())).toEqual([]);
  });

  it('flags missing name with field', () => {
    const issues = validateFlow(
      baseFlow({
        nodes: [{ ...baseFlow().nodes[0], name: '   ' }],
      }),
    );
    expect(issues[0]).toMatchObject({ nodeId: 'api-1', field: 'name' });
  });

  it('flags branching edges', () => {
    const issues = validateFlow(
      baseFlow({
        nodes: [
          baseFlow().nodes[0],
          {
            ...baseFlow().nodes[0],
            id: 'api-2',
            name: 'Second',
          },
        ],
        edges: [
          { id: 'e1', source: 'api-1', target: 'api-2' },
          { id: 'e2', source: 'api-1', target: 'api-2' },
        ],
      }),
    );
    expect(issues.some((issue) => issue.field === 'graph')).toBe(true);
  });
});
