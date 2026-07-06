import { describe, expect, it } from 'vitest';
import { autoLayout } from './flowLayout';
import { toReactNode } from './flowSerialization';
import { createApiNode } from './flowNodeFactory';

describe('autoLayout', () => {
  it('positions nodes in topological order horizontally', () => {
    const nodeA = toReactNode(createApiNode(1, { id: 'a', name: 'A' }));
    const nodeB = toReactNode(createApiNode(2, { id: 'b', name: 'B' }));
    const laidOut = autoLayout([nodeB, nodeA], [{ id: 'e1', source: 'a', target: 'b' }]);
    const a = laidOut.find((node) => node.id === 'a');
    const b = laidOut.find((node) => node.id === 'b');
    expect(a?.position.x).toBeLessThan(b?.position.x ?? 0);
  });
});
