export class RingBuffer<T> {
  private readonly items: T[] = [];

  constructor(private readonly capacity: number) {
    if (capacity < 1) {
      throw new Error('RingBuffer capacity must be positive');
    }
  }

  push(item: T): T[] {
    this.items.push(item);
    if (this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity);
    }
    return this.toArray();
  }

  toArray(): T[] {
    return [...this.items];
  }
}
