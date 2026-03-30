import { RingBuffer } from '../core/ring-buffer.ts';
import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';

/** Configuration for {@link SMA}. */
export type SMAOptions = {
  /** Rolling window length. Defaults to `14`. */
  readonly period?: number;
};

/**
 * Simple Moving Average (SMA) over a fixed rolling window.
 * Returns `undefined` until the window is full.
 *
 * @see https://en.wikipedia.org/wiki/Moving_average#Simple_moving_average
 */
export class SMA {
  readonly #period: number;
  readonly #window: RingBuffer<number>;
  #sum = 0;

  constructor(options: SMAOptions = {}) {
    const period = options.period ?? 14;
    assertPositiveInteger('period', period);
    this.#period = period;
    this.#window = new RingBuffer<number>(period);
  }

  /** Commits a new value into the moving average state. */
  next(value: number): number | undefined {
    assertFiniteNumber('value', value);

    const overwritten = this.#window.push(value);

    if (overwritten !== undefined) {
      this.#sum -= overwritten;
    }

    this.#sum += value;

    if (!this.#window.isFull) {
      return undefined;
    }

    return this.#sum / this.#period;
  }

  /** Projects the next average without mutating committed state. */
  moment(value: number): number | undefined {
    assertFiniteNumber('value', value);
    if (!this.#window.isFull) {
      return undefined;
    }
    const projectedSum = this.#sum - this.#window.oldest()! + value;

    return projectedSum / this.#period;
  }

  /** Computes a full SMA series from an iterable input. */
  static from(values: Iterable<number>, options: SMAOptions = {}): Array<number | undefined> {
    const indicator = new SMA(options);
    return Array.from(values, (value) => indicator.next(value));
  }
}

/**
 * Batch helper for calculating a full SMA series.
 *
 * @see https://en.wikipedia.org/wiki/Moving_average#Simple_moving_average
 */
export function sma(
  values: Iterable<number>,
  options: SMAOptions = {},
): Array<number | undefined> {
  return SMA.from(values, options);
}
