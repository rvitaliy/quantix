import { assertPositiveInteger } from './validation.ts';

export class RingBuffer<T> {
  readonly #values: (T | undefined)[];
  #cursor = 0;
  #size = 0;

  constructor(readonly capacity: number) {
    assertPositiveInteger('capacity', capacity);
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
    this.#cursor += 1;

    if (this.#cursor === this.capacity) {
      this.#cursor = 0;
    }

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

    const position = this.#cursor + index;
    return this.#values[position < this.capacity ? position : position - this.capacity];
  }

  values(): ReadonlyArray<T> {
    if (this.#size === 0) {
      return [];
    }

    if (this.#size < this.capacity) {
      return this.#values.slice(0, this.#size) as T[];
    }

    const result = new Array<T>(this.#size);

    for (let index = 0; index < this.#size; index += 1) {
      const position = this.#cursor + index;
      result[index] = this.#values[position < this.capacity ? position : position - this.capacity]!;
    }

    return result;
  }
}
