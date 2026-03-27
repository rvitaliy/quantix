export class RingBuffer<T> {
  readonly #values: (T | undefined)[];
  #cursor = 0;
  #size = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`capacity must be a positive integer, received ${capacity}`);
    }

    this.#values = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this.#size;
  }

  get isFull(): boolean {
    return this.#size === this.capacity;
  }

  push(value: T): T | undefined {
    const overwritten = this.#values[this.#cursor];
    this.#values[this.#cursor] = value;
    this.#cursor = (this.#cursor + 1) % this.capacity;

    if (this.#size < this.capacity) {
      this.#size += 1;
      return undefined;
    }

    return overwritten;
  }

  oldest(): T | undefined {
    if (this.#size === 0) {
      return undefined;
    }

    if (this.#size < this.capacity) {
      return this.#values[0];
    }

    return this.#values[this.#cursor];
  }

  at(index: number): T | undefined {
    if (index < 0 || index >= this.#size) {
      return undefined;
    }

    if (this.#size < this.capacity) {
      return this.#values[index];
    }

    return this.#values[(this.#cursor + index) % this.capacity];
  }

  values(): T[] {
    if (this.#size === 0) {
      return [];
    }

    if (this.#size < this.capacity) {
      return this.#values.slice(0, this.#size) as T[];
    }

    return [
      ...(this.#values.slice(this.#cursor) as T[]),
      ...(this.#values.slice(0, this.#cursor) as T[]),
    ];
  }
}
