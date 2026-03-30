import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';
import { SMA } from './sma.ts';
import { StandardDeviation } from './standard-deviation.ts';

/** Configuration for {@link BollingerBands}. */
export type BollingerBandsOptions = {
  /** Moving window length. Defaults to `20`. */
  readonly period?: number;
  /** Band width multiplier in standard deviations. Defaults to `2`. */
  readonly standardDeviations?: number;
};

/**
 * Output shape produced by {@link BollingerBands}.
 */
export type BollingerBandsResult = {
  /** Lower band value. */
  readonly lower: number;
  /** Middle band value, equal to the rolling SMA. */
  readonly middle: number;
  /** Upper band value. */
  readonly upper: number;
};

/**
 * Bollinger Bands built from a rolling SMA and population standard deviation.
 * Returns lower, middle, and upper bands after the mean window is ready.
 *
 * @see https://en.wikipedia.org/wiki/Bollinger_Bands
 */
export class BollingerBands {
  readonly #standardDeviations: number;
  readonly #sma: SMA;
  readonly #standardDeviation: StandardDeviation;

  constructor(options: BollingerBandsOptions = {}) {
    const period = options.period ?? 20;
    const standardDeviations = options.standardDeviations ?? 2;

    assertPositiveInteger('period', period);
    assertFiniteNumber('standardDeviations', standardDeviations);

    this.#standardDeviations = standardDeviations;
    this.#sma = new SMA({ period });
    this.#standardDeviation = new StandardDeviation({ period });
  }

  /** Commits a new value into the Bollinger Bands state. */
  next(value: number): BollingerBandsResult | undefined {
    assertFiniteNumber('value', value);

    const middle = this.#sma.next(value);
    const deviation = this.#standardDeviation.next(value, middle);

    if (middle === undefined || deviation === undefined) {
      return undefined;
    }

    return projectBands(middle, deviation, this.#standardDeviations);
  }

  /** Projects the next band values without mutating committed state. */
  moment(value: number): BollingerBandsResult | undefined {
    assertFiniteNumber('value', value);

    const middle = this.#sma.moment(value);
    const deviation = this.#standardDeviation.moment(value, middle);

    if (middle === undefined || deviation === undefined) {
      return undefined;
    }

    return projectBands(middle, deviation, this.#standardDeviations);
  }

  /** Computes a full Bollinger Bands series from an iterable input. */
  static from(values: Iterable<number>, options: BollingerBandsOptions = {}): ReadonlyArray<
    BollingerBandsResult | undefined
  > {
    const indicator = new BollingerBands(options);
    return Array.from(values, (value) => indicator.next(value));
  }
}

function projectBands(middle: number, deviation: number, standardDeviations: number): BollingerBandsResult {
  return {
    lower: middle - (deviation * standardDeviations),
    middle,
    upper: middle + (deviation * standardDeviations),
  };
}
