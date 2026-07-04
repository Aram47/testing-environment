import * as yaml from 'js-yaml';
import { FlowSuiteCompilerService } from './flow-suite-compiler.service';
import { FlowSuiteDefinition } from './types/flow-suite.types';

describe('FlowSuiteCompilerService', () => {
  const service = new FlowSuiteCompilerService();

  it('compiles a single API node to runnable YAML', () => {
    const result = service.compile({
      version: '1.0',
      suiteName: 'Health',
      nodes: [
        {
          id: 'health',
          position: { x: 0, y: 0 },
          name: 'Health check',
          method: 'GET',
          path: '/health',
          expectStatus: 200,
        },
      ],
      edges: [],
    });

    const parsed = yaml.load(result.yamlContent) as {
      suite: string;
      tests: Array<{ request: { method: string; path: string } }>;
    };
    expect(result.testsCount).toBe(1);
    expect(parsed.suite).toBe('Health');
    expect(parsed.tests[0].request).toMatchObject({ method: 'GET', path: '/health' });
  });

  it('normalizes legacy API nodes without type', () => {
    const result = service.compile({
      version: '1.0',
      suiteName: 'Legacy',
      nodes: [
        {
          id: 'legacy',
          position: { x: 0, y: 0 },
          name: 'Legacy API',
          method: 'GET',
          path: '/legacy',
        },
      ],
      edges: [],
    });

    const parsed = yaml.load(result.yamlContent) as {
      tests: Array<{ type: string; request: { path: string } }>;
    };
    expect(parsed.tests[0].type).toBe('apiRequest');
    expect(parsed.tests[0].request.path).toBe('/legacy');
  });

  it('compiles wait and poll nodes to runnable YAML', () => {
    const result = service.compile({
      version: '1.0',
      suiteName: 'Async',
      nodes: [
        {
          id: 'wait',
          type: 'wait',
          position: { x: 0, y: 0 },
          name: 'Wait for worker',
          durationMs: 1500,
        },
        {
          id: 'poll',
          type: 'pollUntil',
          position: { x: 1, y: 0 },
          name: 'Poll status',
          method: 'GET',
          path: '/jobs/1',
          expectStatus: 200,
          timeoutSeconds: 30,
          intervalSeconds: 2,
          assertions: [{ fieldPath: '$.status', operator: 'equals', expectedValue: 'done' }],
        },
      ],
      edges: [{ id: 'wait-poll', source: 'wait', target: 'poll' }],
    });

    const parsed = yaml.load(result.yamlContent) as {
      tests: Array<{
        type: string;
        wait?: { duration_ms: number };
        poll?: { timeout_seconds: number; request: { expect: { assertions: unknown[] } } };
      }>;
    };
    expect(parsed.tests[0].wait?.duration_ms).toBe(1500);
    expect(parsed.tests[1].type).toBe('pollUntil');
    expect(parsed.tests[1].poll?.timeout_seconds).toBe(30);
    expect(parsed.tests[1].poll?.request.expect.assertions).toHaveLength(1);
  });

  it('orders connected API nodes by dependency', () => {
    const result = service.compile({
      version: '1.0',
      suiteName: 'Auth',
      nodes: [
        { id: 'me', position: { x: 2, y: 0 }, name: 'Me', method: 'GET', path: '/me' },
        {
          id: 'login',
          position: { x: 1, y: 0 },
          name: 'Login',
          method: 'POST',
          path: '/login',
          save: { token: '$.token' },
        },
      ],
      edges: [{ id: 'login-me', source: 'login', target: 'me' }],
    });

    const parsed = yaml.load(result.yamlContent) as { tests: Array<{ name: string }> };
    expect(parsed.tests.map((test) => test.name)).toEqual(['Login', 'Me']);
  });

  it('rejects cyclic flows', () => {
    expect(() =>
      service.compile({
        version: '1.0',
        suiteName: 'Cycle',
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, name: 'A', method: 'GET', path: '/a' },
          { id: 'b', position: { x: 0, y: 0 }, name: 'B', method: 'GET', path: '/b' },
        ],
        edges: [
          { id: 'a-b', source: 'a', target: 'b' },
          { id: 'b-a', source: 'b', target: 'a' },
        ],
      }),
    ).toThrow('Flow contains a cycle');
  });

  it('rejects edges connected to missing nodes', () => {
    const flow: FlowSuiteDefinition = {
      version: '1.0',
      suiteName: 'Broken',
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, name: 'A', method: 'GET', path: '/a' }],
      edges: [{ id: 'a-b', source: 'a', target: 'missing' }],
    };

    expect(() => service.compile(flow)).toThrow(
      'Flow contains an edge connected to a missing node',
    );
  });

  it('rejects invalid wait and poll timings', () => {
    expect(() =>
      service.compile({
        version: '1.0',
        suiteName: 'Invalid wait',
        nodes: [
          { id: 'wait', type: 'wait', position: { x: 0, y: 0 }, name: 'Wait', durationMs: 0 },
        ],
        edges: [],
      }),
    ).toThrow('duration greater than 0');

    expect(() =>
      service.compile({
        version: '1.0',
        suiteName: 'Invalid poll',
        nodes: [
          {
            id: 'poll',
            type: 'pollUntil',
            position: { x: 0, y: 0 },
            name: 'Poll',
            method: 'GET',
            path: '/status',
            timeoutSeconds: 1,
            intervalSeconds: 2,
          },
        ],
        edges: [],
      }),
    ).toThrow('interval cannot be greater than timeout');
  });

  it('warns about duplicate saved variables', () => {
    const result = service.compile({
      version: '1.0',
      suiteName: 'Duplicates',
      nodes: [
        {
          id: 'a',
          position: { x: 0, y: 0 },
          name: 'A',
          method: 'GET',
          path: '/a',
          save: { token: '$.token' },
        },
        {
          id: 'b',
          position: { x: 1, y: 0 },
          name: 'B',
          method: 'GET',
          path: '/b',
          save: { token: '$.token' },
        },
      ],
      edges: [],
    });

    expect(result.warnings).toHaveLength(1);
  });
});
