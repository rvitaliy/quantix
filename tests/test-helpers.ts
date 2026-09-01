import { assertAlmostEquals, assertExists, assertStrictEquals } from '@std/assert';

export function assertDefined<T>(value: T | undefined): T {
  assertExists(value);
  return value as T;
}

export function assertDefinedNumber(value: number | undefined): number {
  return assertDefined(value);
}

export function assertOptionalNumberSeriesAlmostEquals(
  actual: ReadonlyArray<number | undefined>,
  expected: ReadonlyArray<number | undefined>,
): void {
  assertStrictEquals(actual.length, expected.length);

  for (let index = 0; index < expected.length; index += 1) {
    const expectedValue = expected[index];
    const actualValue = actual[index];

    if (expectedValue === undefined) {
      assertStrictEquals(actualValue, undefined, `expected warm-up at index ${index}`);
      continue;
    }

    assertAlmostEquals(assertDefinedNumber(actualValue), expectedValue, 1e-10);
  }
}

/** Reference implementation intentionally independent from the streaming classes. */
export function referenceSma(values: readonly number[], period: number): ReadonlyArray<number | undefined> {
  return values.map((_, index) => {
    if (index + 1 < period) {
      return undefined;
    }

    return scaledMean(values.slice(index + 1 - period, index + 1));
  });
}

/** Reference implementation of Wilder's smoothed moving average. */
export function referenceSmma(values: readonly number[], period: number): ReadonlyArray<number | undefined> {
  let average: number | undefined;

  return values.map((value, index) => {
    if (average !== undefined) {
      average += (value - average) / period;
      return average;
    }

    if (index + 1 < period) {
      return undefined;
    }

    average = scaledMean(values.slice(0, period));
    return average;
  });
}

/** Population deviation, using scaling so large yet representable results stay finite. */
export function populationDeviation(values: readonly number[]): number {
  const mean = scaledMean(values);
  let scale = 0;

  for (const value of values) {
    scale = Math.max(scale, Math.abs(value - mean));
  }

  if (scale === 0) {
    return 0;
  }

  let scaledSquaredDistanceSum = 0;
  for (const value of values) {
    const scaledDistance = (value - mean) / scale;
    scaledSquaredDistanceSum += scaledDistance * scaledDistance;
  }

  return scale * Math.sqrt(scaledSquaredDistanceSum / values.length);
}

export function referenceStandardDeviation(
  values: readonly number[],
  period: number,
): ReadonlyArray<number | undefined> {
  return values.map((_, index) => {
    if (index + 1 < period) {
      return undefined;
    }

    return populationDeviation(values.slice(index + 1 - period, index + 1));
  });
}

/** Reference implementation of RSI with Wilder smoothing and a neutral flat-market value. */
export function referenceRsi(values: readonly number[], period: number): ReadonlyArray<number | undefined> {
  let averageGain: number | undefined;
  let averageLoss: number | undefined;
  let gainSum = 0;
  let lossSum = 0;

  return values.map((value, index) => {
    if (index === 0) {
      return undefined;
    }

    const change = value - values[index - 1]!;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (averageGain === undefined || averageLoss === undefined) {
      gainSum += gain;
      lossSum += loss;

      if (index < period) {
        return undefined;
      }

      averageGain = gainSum / period;
      averageLoss = lossSum / period;
      return rsiFromAverages(averageGain, averageLoss);
    }

    averageGain += (gain - averageGain) / period;
    averageLoss += (loss - averageLoss) / period;
    return rsiFromAverages(averageGain, averageLoss);
  });
}

function rsiFromAverages(averageGain: number, averageLoss: number): number {
  if (averageGain === 0 && averageLoss === 0) {
    return 50;
  }

  if (averageLoss === 0) {
    return 100;
  }

  if (averageGain === 0) {
    return 0;
  }

  return 100 - (100 / (1 + (averageGain / averageLoss)));
}

function scaledMean(values: readonly number[]): number {
  let scale = 0;
  for (const value of values) {
    scale = Math.max(scale, Math.abs(value));
  }

  if (scale === 0) {
    return 0;
  }

  let scaledSum = 0;
  for (const value of values) {
    scaledSum += value / scale;
  }

  return (scaledSum / values.length) * scale;
}
