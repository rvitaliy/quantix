import { assertPositiveInteger } from '../core/validation.ts';
import { RollingWindowStats } from '../internal/rolling-window-stats.ts';

/** Configuration for {@link StandardDeviation}. */
export type StandardDeviationOptions = {
  /** Rolling sample length. Defaults to `20`. */
  readonly period?: number;
};

/**
 * Rolling population standard deviation over a fixed window.
 * Returns `undefined` until the window is full.
 *
 * @see https://en.wikipedia.org/wiki/Standard_deviation
 */
export class StandardDeviation {
  readonly #statistics: RollingWindowStats;

  /** Creates a rolling population standard deviation. */
  constructor(options: StandardDeviationOptions = {}) {
    const period = options.period === undefined ? 20 : options.period;
    assertPositiveInteger('period', period);
    this.#statistics = new RollingWindowStats(period);
  }

  /** Commits a new value into the rolling deviation window. */
  next(value: number): number | undefined {
    if (!this.#statistics.prepareNext(value)) {
      this.#statistics.commitPrepared();
      return undefined;
    }

    const result = this.#statistics.previewStandardDeviation;
    this.#statistics.commitPrepared();
    return result;
  }

  /** Projects the next deviation without mutating committed state. */
  moment(value: number): number | undefined {
    if (!this.#statistics.preview(value)) {
      return undefined;
    }

    return this.#statistics.previewStandardDeviation;
  }

  /** Computes a full standard deviation series from an iterable input. */
  static from(values: Iterable<number>, options: StandardDeviationOptions = {}): ReadonlyArray<number | undefined> {
    const indicator = new StandardDeviation(options);
    const result: Array<number | undefined> = [];

    for (const value of values) {
      result.push(indicator.next(value));
    }

    return result;
  }
}
