import { assertNonNegativeFiniteNumber, assertPositiveInteger } from '../core/validation.ts';
import { RollingWindowStats } from '../internal/rolling-window-stats.ts';

/** Configuration for {@link BollingerBands}. */
export type BollingerBandsOptions = {
  /** Moving window length. Defaults to `20`. */
  readonly period?: number;
  /** Band width multiplier in standard deviations. Defaults to `2`. */
  readonly standardDeviations?: number;
};

/** Output shape produced by {@link BollingerBands}. */
export type BollingerBandsResult = {
  /** Lower band value. */
  readonly lower: number;
  /** Middle band value, equal to the rolling SMA. */
  readonly middle: number;
  /** Upper band value. */
  readonly upper: number;
};

/**
 * Bollinger Bands built from one rolling mean and population-variance state.
 * Returns lower, middle, and upper bands after the window is ready.
 *
 * @see https://en.wikipedia.org/wiki/Bollinger_Bands
 */
export class BollingerBands {
  readonly #standardDeviations: number;
  readonly #statistics: RollingWindowStats;

  /** Creates Bollinger Bands with the requested period and width. */
  constructor(options: BollingerBandsOptions = {}) {
    const period = options.period === undefined ? 20 : options.period;
    const standardDeviations = options.standardDeviations === undefined ? 2 : options.standardDeviations;

    assertPositiveInteger('period', period);
    assertNonNegativeFiniteNumber('standardDeviations', standardDeviations);

    this.#standardDeviations = standardDeviations;
    this.#statistics = new RollingWindowStats(period);
  }

  /**
   * Commits a new value into the Bollinger Bands state.
   *
   * @throws {RangeError} If a projected band is outside the finite number range.
   */
  next(value: number): BollingerBandsResult | undefined {
    if (!this.#statistics.prepareNext(value)) {
      this.#statistics.commitPrepared();
      return undefined;
    }

    const result = projectBands(
      this.#statistics.previewMean!,
      this.#statistics.previewStandardDeviation!,
      this.#standardDeviations,
    );
    this.#statistics.commitPrepared();
    return result;
  }

  /**
   * Projects the next band values without mutating committed state.
   *
   * @throws {RangeError} If a projected band is outside the finite number range.
   */
  moment(value: number): BollingerBandsResult | undefined {
    if (!this.#statistics.preview(value)) {
      return undefined;
    }

    return projectBands(
      this.#statistics.previewMean!,
      this.#statistics.previewStandardDeviation!,
      this.#standardDeviations,
    );
  }

  /** Computes a full Bollinger Bands series from an iterable input. */
  static from(values: Iterable<number>, options: BollingerBandsOptions = {}): ReadonlyArray<
    BollingerBandsResult | undefined
  > {
    const indicator = new BollingerBands(options);
    const result: Array<BollingerBandsResult | undefined> = [];

    for (const value of values) {
      result.push(indicator.next(value));
    }

    return result;
  }
}

function projectBands(middle: number, deviation: number, standardDeviations: number): BollingerBandsResult {
  const width = deviation * standardDeviations;
  const lower = middle - width;
  const upper = middle + width;

  if (!Number.isFinite(lower) || !Number.isFinite(middle) || !Number.isFinite(upper)) {
    throw new RangeError('Bollinger Bands result must contain only finite numbers');
  }

  return {
    lower,
    middle,
    upper,
  };
}
