import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';
import { AvgChangeProvider } from '../internal/avg-change.ts';

/** Configuration for {@link RSI}. */
export type RSIOptions = {
  /** Wilder smoothing length. Defaults to `14`. */
  readonly period?: number;
};

/**
 * Relative Strength Index (RSI) using Wilder-style smoothed gains and losses.
 * Returns values in the `0..100` range after the seed period.
 * @see https://en.wikipedia.org/wiki/Relative_strength_index
 */
export class RSI {
  readonly #changes: AvgChangeProvider;

  constructor(options: RSIOptions = {}) {
    const period = options.period ?? 14;
    assertPositiveInteger('period', period);
    this.#changes = new AvgChangeProvider(period);
  }

  /** Commits a new value into the RSI state. */
  next(value: number): number | undefined {
    assertFiniteNumber('value', value);
    const averages = this.#changes.next(value);
    return projectRsi(averages);
  }

  /** Projects the next RSI value without mutating committed state. */
  moment(value: number): number | undefined {
    assertFiniteNumber('value', value);
    const averages = this.#changes.moment(value);
    return projectRsi(averages);
  }

  /** Computes a full RSI series from an iterable input. */
  static from(values: Iterable<number>, options: RSIOptions = {}): Array<number | undefined> {
    const indicator = new RSI(options);
    return Array.from(values, (value) => indicator.next(value));
  }
}

/**
 * Batch helper for calculating a full RSI series.
 *
 * @see https://en.wikipedia.org/wiki/Relative_strength_index
 */
export function rsi(
  values: Iterable<number>,
  options: RSIOptions = {},
): Array<number | undefined> {
  return RSI.from(values, options);
}

function projectRsi(averages: { averageGain: number; averageLoss: number } | undefined): number | undefined {
  if (averages === undefined) {
    return undefined;
  }

  const avgGain = averages.averageGain;
  const avgLoss = averages.averageLoss;

  if (avgLoss === 0) {
    return 100;
  }

  const relativeStrength = avgGain / avgLoss;
  return 100 - (100 / (1 + relativeStrength));
}
