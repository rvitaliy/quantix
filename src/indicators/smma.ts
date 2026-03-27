import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';

export type SMMAOptions = {
  readonly period?: number;
};

/**
 * Smoothed Moving Average (SMMA), also known as Wilder smoothing.
 * Returns `undefined` until the seed window is complete.
 *
 * @see https://en.wikipedia.org/wiki/Moving_average#Modified_moving_average
 */
export class SMMA {
  readonly #period: number;
  #sum = 0;
  #average: number | undefined;
  #filled = 0;

  constructor(options: SMMAOptions = {}) {
    const period = options.period ?? 14;
    assertPositiveInteger('period', period);
    this.#period = period;
  }

  next(value: number): number | undefined {
    assertFiniteNumber('value', value);

    if (this.#average !== undefined) {
      this.#average = this.#project(value);
      return this.#average;
    }

    this.#sum += value;
    this.#filled += 1;

    if (this.#filled < this.#period) {
      return undefined;
    }

    this.#average = this.#sum / this.#period;
    return this.#average;
  }

  moment(value: number): number | undefined {
    assertFiniteNumber('value', value);

    if (this.#average === undefined) {
      return undefined;
    }

    return this.#project(value);
  }

  static from(values: Iterable<number>, options: SMMAOptions = {}): Array<number | undefined> {
    const indicator = new SMMA(options);
    return Array.from(values, (value) => indicator.next(value));
  }

  #project(value: number): number {
    return ((this.#average! * (this.#period - 1)) + value) / this.#period;
  }
}

/**
 * Batch helper for calculating a full SMMA series.
 *
 * @see https://en.wikipedia.org/wiki/Moving_average#Modified_moving_average
 */
export function smma(
  values: Iterable<number>,
  options: SMMAOptions = {},
): Array<number | undefined> {
  return SMMA.from(values, options);
}
