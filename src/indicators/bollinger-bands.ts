import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';
import { SMA } from './sma.ts';
import { StandardDeviation } from './standard-deviation.ts';

export type BollingerBandsOptions = {
  readonly period?: number;
  readonly standardDeviations?: number;
};

export type BollingerBandsResult = {
  readonly lower: number;
  readonly middle: number | undefined;
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

  next(value: number): BollingerBandsResult | undefined {
    assertFiniteNumber('value', value);

    const middle = this.#sma.next(value);
    const deviation = this.#standardDeviation.next(value, middle);

    if (middle === undefined) {
      return undefined;
    }

    return projectBands(middle, deviation, this.#standardDeviations);
  }

  moment(value: number): BollingerBandsResult | undefined {
    assertFiniteNumber('value', value);

    const middle = this.#sma.moment(value);
    const deviation = this.#standardDeviation.moment(value, middle);

    return projectBands(middle, deviation, this.#standardDeviations);
  }

  static from(values: Iterable<number>, options: BollingerBandsOptions = {}): Array<
    BollingerBandsResult | undefined
  > {
    const indicator = new BollingerBands(options);
    return Array.from(values, (value) => indicator.next(value));
  }
}

/**
 * Batch helper for calculating a full Bollinger Bands series.
 *
 * @see https://en.wikipedia.org/wiki/Bollinger_Bands
 */
export function bollingerBands(
  values: Iterable<number>,
  options: BollingerBandsOptions = {},
): Array<BollingerBandsResult | undefined> {
  return BollingerBands.from(values, options);
}

function projectBands(
  middle: number | undefined,
  deviation: number,
  standardDeviations: number,
): BollingerBandsResult | undefined {
  if (middle === undefined) {
    if (Number.isNaN(deviation) === true) {
      return {
        lower: Number.NaN,
        middle: undefined,
        upper: Number.NaN,
      };
    }

    return undefined;
  }

  return {
    lower: middle - (deviation * standardDeviations),
    middle,
    upper: middle + (deviation * standardDeviations),
  };
}
