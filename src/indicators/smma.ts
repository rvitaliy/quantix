import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';
import { WilderAverage } from '../internal/wilder-average.ts';

/** Configuration for {@link SMMA}. */
export type SMMAOptions = {
  /** Smoothing length. Defaults to `14`. */
  readonly period?: number;
};

/**
 * Smoothed Moving Average (SMMA), also known as Wilder smoothing.
 * Returns `undefined` until the seed window is complete.
 *
 * @see https://en.wikipedia.org/wiki/Moving_average#Modified_moving_average
 */
export class SMMA {
  readonly #average: WilderAverage;

  /** Creates an SMMA with the requested smoothing period. */
  constructor(options: SMMAOptions = {}) {
    const period = options.period === undefined ? 14 : options.period;
    assertPositiveInteger('period', period);
    this.#average = new WilderAverage(period);
  }

  /** Commits a new value into the smoothed average state. */
  next(value: number): number | undefined {
    assertFiniteNumber('value', value);

    return this.#average.next(value);
  }

  /** Projects the next smoothed average without mutating committed state. */
  moment(value: number): number | undefined {
    assertFiniteNumber('value', value);

    return this.#average.preview(value);
  }

  /** Computes a full SMMA series from an iterable input. */
  static from(values: Iterable<number>, options: SMMAOptions = {}): ReadonlyArray<number | undefined> {
    const indicator = new SMMA(options);
    const result: Array<number | undefined> = [];

    for (const value of values) {
      result.push(indicator.next(value));
    }

    return result;
  }
}
