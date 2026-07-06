import { describe, expect, it } from 'vitest';
import { findDuplicateIds, hasBranching, hasCycle, topologicalSort } from './flowGraph';

describe('flowGraph', () => {
  it('sorts nodes topologically', () => {
    const ordered = topologicalSort(['a', 'b', 'c'], [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ]);
    expect(ordered).toEqual(['a', 'b', 'c']);
  });

  it('detects cycles', () => {
    expect(
      hasCycle(['a', 'b'], [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ]),
    ).toBe(true);
  });

  it('detects branching', () => {
    expect(
      hasBranching([
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
      ]),
    ).toBe(true);
  });

  it('finds duplicate ids', () => {
    expect(findDuplicateIds(['a', 'b', 'a'])).toEqual(['a']);
  });
});
