import { assertAlmostEquals, assertStrictEquals, assertThrows } from '@std/assert';

import { RollingWindowStats } from '../../src/internal/rolling-window-stats.ts';
import { CLOSES } from '../fixtures/daily-closes.ts';
import { assertDefinedNumber, populationDeviation, referenceSma } from '../test-helpers.ts';

Deno.test('RollingWindowStats exposes mean and population deviation once its window is full', () => {
  const period = 5;
  const statistics = new RollingWindowStats(period);
  const window = CLOSES.slice(0, period);

  for (const close of window.slice(0, -1)) {
    assertStrictEquals(statistics.next(close), false);
    assertStrictEquals(statistics.mean, undefined);
    assertStrictEquals(statistics.standardDeviation, undefined);
  }

  assertStrictEquals(statistics.next(window.at(-1)!), true);
  assertAlmostEquals(statistics.mean!, assertDefinedNumber(referenceSma(window, period).at(-1)));
  assertAlmostEquals(statistics.standardDeviation!, populationDeviation(window));
});

Deno.test('RollingWindowStats preview can complete warm-up without committing', () => {
  const period = 5;
  const statistics = new RollingWindowStats(period);
  const committedCloses = CLOSES.slice(0, period - 1);
  const indicativeClose = CLOSES[period - 1]!;

  for (const close of committedCloses) {
    statistics.next(close);
  }

  const projectedWindow = [...committedCloses, indicativeClose];
  assertStrictEquals(statistics.preview(indicativeClose), true);
  assertAlmostEquals(
    statistics.previewMean!,
    assertDefinedNumber(referenceSma(projectedWindow, period).at(-1)),
  );
  assertAlmostEquals(statistics.previewStandardDeviation!, populationDeviation(projectedWindow));
  assertStrictEquals(statistics.mean, undefined);
  assertStrictEquals(statistics.standardDeviation, undefined);

  assertStrictEquals(statistics.next(indicativeClose), true);
  assertAlmostEquals(statistics.mean!, statistics.previewMean!);
  assertAlmostEquals(statistics.standardDeviation!, statistics.previewStandardDeviation!);
});

Deno.test('RollingWindowStats preview leaves an established window unchanged', () => {
  const period = 5;
  const committedCloses = CLOSES.slice(0, 8);
  const officialClose = CLOSES[8]!;
  const statistics = new RollingWindowStats(period);
  const control = new RollingWindowStats(period);

  for (const close of committedCloses) {
    statistics.next(close);
    control.next(close);
  }

  assertStrictEquals(statistics.preview(190.55), true);
  assertStrictEquals(statistics.next(officialClose), true);
  assertStrictEquals(control.next(officialClose), true);
  assertAlmostEquals(statistics.mean!, control.mean!);
  assertAlmostEquals(statistics.standardDeviation!, control.standardDeviation!);
});

Deno.test('RollingWindowStats follows rolling references across periodic state rebuilds', () => {
  const period = 5;
  const statistics = new RollingWindowStats(period);
  const expectedMeans = referenceSma(CLOSES, period);

  for (let index = 0; index < CLOSES.length; index += 1) {
    const ready = statistics.next(CLOSES[index]!);
    if (index + 1 < period) {
      assertStrictEquals(ready, false);
      continue;
    }

    const window = CLOSES.slice(index + 1 - period, index + 1);
    assertStrictEquals(ready, true);
    assertAlmostEquals(statistics.mean!, assertDefinedNumber(expectedMeans[index]), 1e-10);
    assertAlmostEquals(statistics.standardDeviation!, populationDeviation(window), 1e-10);
  }
});

Deno.test('RollingWindowStats maintenance keeps repeated previews aligned with the committed projection', () => {
  const statistics = new RollingWindowStats(3);
  const control = new RollingWindowStats(3);
  const committed = [
    0,
    999_999.999,
    1_000_000.001,
    999_999.999,
    1_000_000.001,
  ] as const;
  const candidate = 999_999.999;

  for (const value of committed) {
    statistics.next(value);
    control.next(value);
  }

  const committedMean = statistics.mean;
  const committedDeviation = statistics.standardDeviation;
  assertStrictEquals(statistics.preview(candidate), true);
  const previewMean = statistics.previewMean;
  const previewDeviation = statistics.previewStandardDeviation;

  for (let index = 0; index < 10; index += 1) {
    assertStrictEquals(statistics.preview(candidate), true);
    assertStrictEquals(statistics.previewMean, previewMean);
    assertStrictEquals(statistics.previewStandardDeviation, previewDeviation);
  }

  assertStrictEquals(statistics.mean, committedMean);
  assertStrictEquals(statistics.standardDeviation, committedDeviation);
  assertStrictEquals(control.next(candidate), true);
  assertStrictEquals(previewMean, control.mean);
  assertStrictEquals(previewDeviation, control.standardDeviation);
  assertStrictEquals(statistics.next(candidate), true);
  assertStrictEquals(statistics.mean, control.mean);
  assertStrictEquals(statistics.standardDeviation, control.standardDeviation);
});

Deno.test('RollingWindowStats rebuilds when removing the outgoing value cancels its aggregates', () => {
  const values = [
    5.23706805327466e-99,
    7.507304589781854e117,
    -13_343_537_100,
    1.7381686995437367e108,
    1.450671942341769e-140,
  ] as const;
  const expectedMean = 5.7938956651457887e107;
  const expectedDeviation = 8.193805828623859e107;
  const statistics = new RollingWindowStats(3);

  for (const value of values.slice(0, -1)) {
    statistics.next(value);
  }

  const committedMean = statistics.mean;
  const committedDeviation = statistics.standardDeviation;
  const candidate = values.at(-1)!;

  assertStrictEquals(statistics.preview(candidate), true);
  assertAlmostEquals(statistics.previewMean! / expectedMean, 1, 1e-12);
  assertAlmostEquals(statistics.previewStandardDeviation! / expectedDeviation, 1, 1e-12);
  assertStrictEquals(statistics.mean, committedMean);
  assertStrictEquals(statistics.standardDeviation, committedDeviation);

  assertStrictEquals(statistics.next(candidate), true);
  assertAlmostEquals(statistics.mean! / expectedMean, 1, 1e-12);
  assertAlmostEquals(statistics.standardDeviation! / expectedDeviation, 1, 1e-12);
});

Deno.test('RollingWindowStats keeps large representable statistics finite', () => {
  const statistics = new RollingWindowStats(2);

  assertStrictEquals(statistics.next(8e299), false);
  assertStrictEquals(statistics.next(1.2e300), true);
  assertStrictEquals(Number.isFinite(statistics.mean!), true);
  assertStrictEquals(Number.isFinite(statistics.standardDeviation!), true);
  assertAlmostEquals(statistics.mean! / 1e300, 1, 1e-12);
  assertAlmostEquals(statistics.standardDeviation! / 2e299, 1, 1e-12);
});

Deno.test('RollingWindowStats retains duplicate scale maxima without repeated rescaling', () => {
  const period = 4;
  const maximum = Number.MAX_VALUE;
  const statistics = new RollingWindowStats(period);
  const normalizedWindow = [1, 1, 1, 1];

  for (let index = 0; index < period; index += 1) {
    statistics.next(maximum);
  }

  for (const normalizedCandidate of [0.5, 0.4, 0.3, 0.2]) {
    normalizedWindow.shift();
    normalizedWindow.push(normalizedCandidate);
    const expectedMean = normalizedWindow.reduce((sum, value) => sum + value, 0) / period;
    const expectedDeviation = populationDeviation(normalizedWindow);
    const candidate = normalizedCandidate * maximum;

    assertStrictEquals(statistics.preview(candidate), true);
    assertAlmostEquals(statistics.previewMean! / maximum, expectedMean, 1e-12);
    assertAlmostEquals(statistics.previewStandardDeviation! / maximum, expectedDeviation, 1e-12);
    assertStrictEquals(statistics.next(candidate), true);
    assertAlmostEquals(statistics.mean! / maximum, expectedMean, 1e-12);
    assertAlmostEquals(statistics.standardDeviation! / maximum, expectedDeviation, 1e-12);
  }
});

Deno.test('RollingWindowStats follows repeated multi-scale contractions and expansions', () => {
  const period = 5;
  const magnitudes = [1e300, 1e200, 1e100, 1, 1e-100, 1e-200, 1e-300] as const;
  const sequence: number[] = [];

  for (const magnitude of [...magnitudes, ...magnitudes.toReversed()]) {
    for (let index = 0; index < period + 1; index += 1) {
      sequence.push(index % 2 === 0 ? magnitude : -magnitude);
    }
  }

  const statistics = new RollingWindowStats(period);
  const window: number[] = [];

  for (const value of sequence) {
    window.push(value);
    if (window.length > period) {
      window.shift();
    }

    const ready = statistics.preview(value);
    if (window.length < period) {
      assertStrictEquals(ready, false);
      statistics.next(value);
      continue;
    }

    const expected = populationDeviation(window);
    assertStrictEquals(ready, true);
    assertAlmostEquals(statistics.previewStandardDeviation! / expected, 1, 1e-12);
    assertStrictEquals(statistics.next(value), true);
    assertAlmostEquals(statistics.standardDeviation! / expected, 1, 1e-12);
  }
});

Deno.test('RollingWindowStats rejects invalid values before mutating committed state', () => {
  const statistics = new RollingWindowStats(3);
  const control = new RollingWindowStats(3);

  for (const close of CLOSES.slice(0, 3)) {
    statistics.next(close);
    control.next(close);
  }

  assertThrows(() => statistics.next(Number.NaN));
  assertThrows(() => statistics.preview(Number.POSITIVE_INFINITY));

  statistics.next(CLOSES[3]!);
  control.next(CLOSES[3]!);
  assertAlmostEquals(statistics.mean!, control.mean!);
  assertAlmostEquals(statistics.standardDeviation!, control.standardDeviation!);
});
