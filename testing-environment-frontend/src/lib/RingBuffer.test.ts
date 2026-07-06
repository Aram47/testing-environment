import { describe, expect, it } from 'vitest';
import { RingBuffer } from './RingBuffer';

describe('RingBuffer', () => {
  it('keeps only the most recent items up to capacity', () => {
    const buffer = new RingBuffer<number>(3);
    expect(buffer.push(1)).toEqual([1]);
    expect(buffer.push(2)).toEqual([1, 2]);
    expect(buffer.push(3)).toEqual([1, 2, 3]);
    expect(buffer.push(4)).toEqual([2, 3, 4]);
  });

  it('rejects non-positive capacity', () => {
    expect(() => new RingBuffer(0)).toThrow('RingBuffer capacity must be positive');
  });
});
