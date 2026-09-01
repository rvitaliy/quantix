import { RingBuffer } from '../core/ring-buffer.ts';
import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';
import { projectWeightedAverage } from '../internal/numeric.ts';

const CANCELLATION_THRESHOLD = 1e-6;

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
  readonly #summationDivisor: number;
  readonly #window: RingBuffer<number>;
  #average = 0;
  #conditioningScale = 0;
  #correction = 0;
  #previewAverage = 0;
  #previewConditioningScale = 0;
  #previewCorrection = 0;
  #previewRebaseAge = 0;
  #rebaseAge = 0;

  /** Creates an SMA with the requested rolling period. */
  constructor(options: SMAOptions = {}) {
    const period = options.period === undefined ? 14 : options.period;
    assertPositiveInteger('period', period);
    this.#period = period;
    this.#summationDivisor = nextPowerOfTwo(period);
    this.#window = new RingBuffer<number>(period);
  }

  /** Commits a new value into the moving average state. */
  next(value: number): number | undefined {
    assertFiniteNumber('value', value);

    if (this.#period === 1) {
      this.#window.push(value);
      this.#average = value;
      return value;
    }

    this.#project(value);
    this.#window.push(value);
    this.#average = this.#previewAverage;
    this.#conditioningScale = this.#previewConditioningScale;
    this.#correction = this.#previewCorrection;
    this.#rebaseAge = this.#previewRebaseAge;

    if (!this.#window.isFull) {
      return undefined;
    }

    const result = this.#average;

    if (this.#rebaseAge >= this.#period) {
      this.#average = this.#rebuildAverage(this.#window.oldest()!);
      this.#conditioningScale = Math.abs(this.#average);
      this.#correction = 0;
      this.#rebaseAge = 0;
    }

    return result;
  }

  /** Projects the next average without mutating committed state. */
  moment(value: number): number | undefined {
    assertFiniteNumber('value', value);

    if (this.#period === 1) {
      return value;
    }

    if (this.#window.size + 1 < this.#period) {
      return undefined;
    }

    this.#project(value);
    return this.#previewAverage;
  }

  /** Computes a full SMA series from an iterable input. */
  static from(values: Iterable<number>, options: SMAOptions = {}): ReadonlyArray<number | undefined> {
    const indicator = new SMA(options);
    const result: Array<number | undefined> = [];

    for (const value of values) {
      result.push(indicator.next(value));
    }

    return result;
  }

  #project(value: number): void {
    const size = this.#window.size;
    let average: number;
    let conditioningScale = this.#conditioningScale;
    let correction = this.#correction;
    let rebaseAge = this.#rebaseAge + 1;
    let requiresRebuild = false;

    if (size === 0) {
      average = value;
      conditioningScale = Math.abs(average);
      correction = 0;
    } else if (size < this.#period) {
      if (size + 1 === this.#period) {
        average = this.#rebuildAverage(value, 0);
        conditioningScale = Math.abs(average);
        rebaseAge = 0;
      } else {
        average = projectWeightedAverage(this.#average, value, size + 1);
        conditioningScale = Math.max(conditioningScale, Math.abs(average));
      }

      correction = 0;
    } else {
      average = this.#average;
      const outgoing = this.#window.oldest()!;
      const difference = value - outgoing;

      if (Number.isFinite(difference)) {
        const averageDelta = difference / this.#period;
        const adjustment = averageDelta - correction;
        const nextAverage = average + adjustment;
        conditioningScale = Math.max(conditioningScale, Math.abs(average), Math.abs(adjustment));
        requiresRebuild = (difference !== 0 && averageDelta === 0) ||
          hasSignificantCancellation(conditioningScale, nextAverage);
        correction = (nextAverage - average) - adjustment;
        average = nextAverage;
      } else {
        let adjustment = (-outgoing / this.#period) - correction;
        let nextAverage = average + adjustment;
        conditioningScale = Math.max(conditioningScale, Math.abs(average), Math.abs(adjustment));
        requiresRebuild = hasSignificantCancellation(conditioningScale, nextAverage);
        correction = (nextAverage - average) - adjustment;
        average = nextAverage;

        adjustment = (value / this.#period) - correction;
        nextAverage = average + adjustment;
        conditioningScale = Math.max(conditioningScale, Math.abs(average), Math.abs(adjustment));
        requiresRebuild = requiresRebuild || hasSignificantCancellation(conditioningScale, nextAverage);
        correction = (nextAverage - average) - adjustment;
        average = nextAverage;
      }
    }

    if (requiresRebuild || !Number.isFinite(average) || !Number.isFinite(correction)) {
      average = this.#rebuildAverage(value);
      conditioningScale = Math.abs(average);
      correction = 0;
      rebaseAge = 0;
    }

    this.#previewAverage = average;
    this.#previewConditioningScale = conditioningScale;
    this.#previewCorrection = correction;
    this.#previewRebaseAge = rebaseAge;
  }

  #rebuildAverage(value: number, retainedStart = 1): number {
    let scaledSum = 0;
    let correction = 0;
    let hasScaledUnderflow = false;
    let maximumValue = Math.abs(value);
    let maximumTerm = 0;
    let allValuesEqual = true;

    for (let index = retainedStart; index < this.#window.size; index += 1) {
      const retainedValue = this.#window.at(index)!;
      const term = retainedValue / this.#summationDivisor;
      const nextSum = scaledSum + term;

      hasScaledUnderflow = hasScaledUnderflow || (retainedValue !== 0 && term === 0);
      maximumValue = Math.max(maximumValue, Math.abs(retainedValue));

      if (retainedValue !== value) {
        allValuesEqual = false;
      }

      if (Math.abs(scaledSum) >= Math.abs(term)) {
        correction += (scaledSum - nextSum) + term;
      } else {
        correction += (term - nextSum) + scaledSum;
      }

      scaledSum = nextSum;
      maximumTerm = Math.max(maximumTerm, Math.abs(term));
    }

    if (allValuesEqual) {
      return value;
    }

    const scaledValue = value / this.#summationDivisor;
    const nextSum = scaledSum + scaledValue;
    hasScaledUnderflow = hasScaledUnderflow || (value !== 0 && scaledValue === 0);

    if (Math.abs(scaledSum) >= Math.abs(scaledValue)) {
      correction += (scaledSum - nextSum) + scaledValue;
    } else {
      correction += (scaledValue - nextSum) + scaledSum;
    }

    scaledSum = nextSum;
    maximumTerm = Math.max(maximumTerm, Math.abs(scaledValue));

    if (hasScaledUnderflow) {
      return this.#rebuildSubnormalAverage(value, retainedStart, maximumValue);
    }

    const correctedSum = scaledSum + correction;
    if (Number.isFinite(correctedSum) && !hasSignificantCancellation(maximumTerm, correctedSum)) {
      const average = correctedSum * (this.#summationDivisor / this.#period);

      if (Number.isFinite(average)) {
        return average;
      }
    }

    const partials: number[] = [];

    for (let index = retainedStart; index < this.#window.size; index += 1) {
      addPartial(partials, this.#window.at(index)! / this.#summationDivisor);
    }

    addPartial(partials, value / this.#summationDivisor);

    scaledSum = 0;
    for (let index = partials.length - 1; index >= 0; index -= 1) {
      scaledSum += partials[index]!;
    }

    const average = scaledSum * (this.#summationDivisor / this.#period);
    if (Number.isFinite(average)) {
      return average;
    }

    let fallbackAverage = value;
    let count = 1;

    for (let index = retainedStart; index < this.#window.size; index += 1) {
      count += 1;
      fallbackAverage = projectWeightedAverage(fallbackAverage, this.#window.at(index)!, count);
    }

    return fallbackAverage;
  }

  #rebuildSubnormalAverage(value: number, retainedStart: number, scale: number): number {
    let scaledSum = value / scale;
    let correction = 0;

    for (let index = retainedStart; index < this.#window.size; index += 1) {
      const term = this.#window.at(index)! / scale;
      const nextSum = scaledSum + term;

      if (Math.abs(scaledSum) >= Math.abs(term)) {
        correction += (scaledSum - nextSum) + term;
      } else {
        correction += (term - nextSum) + scaledSum;
      }

      scaledSum = nextSum;
    }

    return ((scaledSum + correction) / this.#period) * scale;
  }
}

function hasSignificantCancellation(inputMagnitude: number, result: number): boolean {
  return inputMagnitude > 0 && Math.abs(result) <= inputMagnitude * CANCELLATION_THRESHOLD;
}

function nextPowerOfTwo(value: number): number {
  let result = 1;

  while (result < value) {
    result *= 2;
  }

  return result;
}

function addPartial(partials: number[], value: number): void {
  let next = value;
  let count = 0;

  for (let index = 0; index < partials.length; index += 1) {
    let current = partials[index]!;

    if (Math.abs(next) < Math.abs(current)) {
      const swap = next;
      next = current;
      current = swap;
    }

    const high = next + current;
    const low = current - (high - next);

    if (low !== 0) {
      partials[count] = low;
      count += 1;
    }

    next = high;
  }

  partials.length = count;
  partials.push(next);
}
