import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';
import { WilderAverage } from '../internal/wilder-average.ts';

/** Configuration for {@link RSI}. */
export type RSIOptions = {
  /** Wilder smoothing length. Defaults to `14`. */
  readonly period?: number;
};

/**
 * Relative Strength Index (RSI) using Wilder-style smoothed gains and losses.
 * Returns values in the `0..100` range after the seed period.
 *
 * Flat input maps to `50`, gains without losses to `100`, and losses without
 * gains to `0`.
 *
 * @see https://en.wikipedia.org/wiki/Relative_strength_index
 */
export class RSI {
  readonly #averageGain: WilderAverage;
  readonly #averageLoss: WilderAverage;
  #previousValue: number | undefined;

  /** Creates an RSI with the requested Wilder smoothing period. */
  constructor(options: RSIOptions = {}) {
    const period = options.period === undefined ? 14 : options.period;
    assertPositiveInteger('period', period);
    this.#averageGain = new WilderAverage(period);
    this.#averageLoss = new WilderAverage(period);
  }

  /** Commits a new value into the RSI state. */
  next(value: number): number | undefined {
    assertFiniteNumber('value', value);

    if (this.#previousValue === undefined) {
      this.#previousValue = value;
      return undefined;
    }

    const change = value - this.#previousValue;
    assertFiniteNumber('change', change);

    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    const averageGain = this.#averageGain.preview(gain);
    const averageLoss = this.#averageLoss.preview(loss);

    this.#averageGain.commitPreview();
    this.#averageLoss.commitPreview();
    this.#previousValue = value;

    return projectRsi(averageGain, averageLoss);
  }

  /** Projects the next RSI value without mutating committed state. */
  moment(value: number): number | undefined {
    assertFiniteNumber('value', value);

    if (this.#previousValue === undefined) {
      return undefined;
    }

    const change = value - this.#previousValue;
    assertFiniteNumber('change', change);

    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    return projectRsi(this.#averageGain.preview(gain), this.#averageLoss.preview(loss));
  }

  /** Computes a full RSI series from an iterable input. */
  static from(values: Iterable<number>, options: RSIOptions = {}): ReadonlyArray<number | undefined> {
    const indicator = new RSI(options);
    const result: Array<number | undefined> = [];

    for (const value of values) {
      result.push(indicator.next(value));
    }

    return result;
  }
}

function projectRsi(averageGain: number | undefined, averageLoss: number | undefined): number | undefined {
  if (averageGain === undefined || averageLoss === undefined) {
    return undefined;
  }

  if (averageGain === 0 && averageLoss === 0) {
    return 50;
  }

  if (averageLoss === 0) {
    return 100;
  }

  if (averageGain === 0) {
    return 0;
  }

  if (averageGain > averageLoss) {
    return 100 / (1 + (averageLoss / averageGain));
  }

  const ratio = averageGain / averageLoss;
  return (100 * ratio) / (1 + ratio);
}
