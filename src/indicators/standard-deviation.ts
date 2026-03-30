import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';

/**
 * Configuration for {@link StandardDeviation}.
 * `period` controls the rolling sample length and defaults to `20`.
 */
export type StandardDeviationOptions = {
  readonly period?: number;
};

/**
 * Rolling population standard deviation over a fixed window.
 * Returns `undefined` until the corresponding mean is available.
 *
 * @see https://en.wikipedia.org/wiki/Standard_deviation
 */
export class StandardDeviation {
  readonly #period: number;
  readonly #values: Array<number | undefined>;
  #cursor = 0;
  #size = 0;

  constructor(options: StandardDeviationOptions = {}) {
    const period = options.period ?? 20;
    assertPositiveInteger('period', period);
    this.#period = period;
    this.#values = new Array<number | undefined>(period);
  }

  /** Commits a new value into the rolling deviation window. */
  next(value: number, mean: number | undefined): number | undefined {
    assertFiniteNumber('value', value);

    this.#values[this.#cursor] = value;
    this.#cursor = (this.#cursor + 1) % this.#period;

    if (this.#size < this.#period) {
      this.#size += 1;
    }

    return this.#project(mean);
  }

  /** Projects the next deviation without mutating committed state. */
  moment(value: number, mean: number | undefined): number | undefined {
    assertFiniteNumber('value', value);
    return this.#project(mean, value);
  }

  #project(mean: number | undefined, previewValue?: number): number | undefined {
    if (mean === undefined) {
      return undefined;
    }

    let squaredDistanceSum = 0;
    const projectedSize = previewValue === undefined ? this.#size : Math.min(this.#size + 1, this.#period);

    for (let index = 0; index < this.#size; index += 1) {
      const current = previewValue !== undefined && this.#size === this.#period && index === this.#cursor ? previewValue : this.#values[index]!;
      const distance = current - mean;
      squaredDistanceSum += distance * distance;
    }

    if (previewValue !== undefined && this.#size < this.#period) {
      const distance = previewValue - mean;
      squaredDistanceSum += distance * distance;
    }

    return Math.sqrt(squaredDistanceSum / projectedSize);
  }
}
