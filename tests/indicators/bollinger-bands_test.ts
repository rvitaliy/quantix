import { assertAlmostEquals, assertStrictEquals, assertThrows } from '@std/assert';

import { BollingerBands, type BollingerBandsResult } from '../../mod.ts';
import { closeGenerator, CLOSES } from '../fixtures/daily-closes.ts';
import { assertDefined, assertDefinedNumber, populationDeviation, referenceSma } from '../test-helpers.ts';

Deno.test('BollingerBands matches independent rolling mean and deviation references', () => {
  const period = 20;
  const standardDeviations = 2;
  const actual = BollingerBands.from(CLOSES);
  const expected = referenceBands(CLOSES, period, standardDeviations);

  assertStrictEquals(actual.length, expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    const expectedBands = expected[index];
    if (expectedBands === undefined) {
      assertStrictEquals(actual[index], undefined);
      continue;
    }

    assertBandsAlmostEqual(assertDefined(actual[index]), expectedBands);
  }
});

Deno.test('BollingerBands moment can complete warm-up without committing', () => {
  const period = 5;
  const indicator = new BollingerBands({ period });
  const committedCloses = CLOSES.slice(0, period - 1);
  const indicativeClose = CLOSES[period - 1]!;

  for (const close of committedCloses) {
    assertStrictEquals(indicator.next(close), undefined);
  }

  const expected = assertDefined(referenceBands([...committedCloses, indicativeClose], period, 2).at(-1));
  assertBandsAlmostEqual(assertDefined(indicator.moment(indicativeClose)), expected);
  assertBandsAlmostEqual(assertDefined(indicator.moment(indicativeClose)), expected);
  assertBandsAlmostEqual(assertDefined(indicator.next(indicativeClose)), expected);
});

Deno.test('BollingerBands moment leaves established band state unchanged', () => {
  const period = 5;
  const committedCloses = CLOSES.slice(0, 8);
  const indicativeClose = 190.55;
  const officialClose = CLOSES[8]!;
  const indicator = new BollingerBands({ period });
  const control = new BollingerBands({ period });

  for (const close of committedCloses) {
    indicator.next(close);
    control.next(close);
  }

  const expectedProjection = assertDefined(referenceBands([...committedCloses, indicativeClose], period, 2).at(-1));
  assertBandsAlmostEqual(assertDefined(indicator.moment(indicativeClose)), expectedProjection);
  assertBandsAlmostEqual(assertDefined(indicator.next(officialClose)), assertDefined(control.next(officialClose)));
});

Deno.test('BollingerBands.from consumes a one-shot generator', () => {
  const period = 10;
  const standardDeviations = 1.5;
  const actual = BollingerBands.from(closeGenerator(), { period, standardDeviations });
  const expected = referenceBands(CLOSES, period, standardDeviations);

  assertStrictEquals(actual.length, expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    const expectedBands = expected[index];
    if (expectedBands === undefined) {
      assertStrictEquals(actual[index], undefined);
    } else {
      assertBandsAlmostEqual(assertDefined(actual[index]), expectedBands);
    }
  }
});

Deno.test('BollingerBands validates options and preserves state after invalid observations', () => {
  assertThrows(() => new BollingerBands({ period: Number.MAX_SAFE_INTEGER + 1 }));
  assertThrows(() => new BollingerBands({ period: null as unknown as number }));
  assertThrows(() => new BollingerBands({ standardDeviations: -0.1 }));
  assertThrows(() => new BollingerBands({ standardDeviations: null as unknown as number }));
  assertThrows(() => new BollingerBands({ standardDeviations: Number.POSITIVE_INFINITY }));

  const period = 5;
  const indicator = new BollingerBands({ period });
  const control = new BollingerBands({ period });
  for (const close of CLOSES.slice(0, period + 2)) {
    indicator.next(close);
    control.next(close);
  }

  assertThrows(() => indicator.next(Number.NaN));
  assertThrows(() => indicator.moment(Number.NEGATIVE_INFINITY));

  const nextClose = CLOSES[period + 2]!;
  assertBandsAlmostEqual(assertDefined(indicator.next(nextClose)), assertDefined(control.next(nextClose)));
});

Deno.test('BollingerBands supports a zero-width envelope', () => {
  const indicator = new BollingerBands({ period: 3, standardDeviations: 0 });

  indicator.next(187.42);
  indicator.next(188.11);
  const bands = assertDefined(indicator.next(187.36));

  assertStrictEquals(bands.lower, bands.middle);
  assertStrictEquals(bands.upper, bands.middle);
});

Deno.test('BollingerBands remain finite at a large representable price scale', () => {
  const indicator = new BollingerBands({ period: 2, standardDeviations: 2 });

  assertStrictEquals(indicator.next(8e299), undefined);
  const bands = assertDefined(indicator.next(1.2e300));

  assertStrictEquals(Number.isFinite(bands.lower), true);
  assertStrictEquals(Number.isFinite(bands.middle), true);
  assertStrictEquals(Number.isFinite(bands.upper), true);
  assertAlmostEquals(bands.lower / 6e299, 1, 1e-12);
  assertAlmostEquals(bands.middle / 1e300, 1, 1e-12);
  assertAlmostEquals(bands.upper / 1.4e300, 1, 1e-12);
});

Deno.test('BollingerBands reject an unrepresentable result without committing it', () => {
  const indicator = new BollingerBands({ period: 2 });
  const control = new BollingerBands({ period: 2 });

  assertStrictEquals(indicator.next(-Number.MAX_VALUE), undefined);
  assertStrictEquals(control.next(-Number.MAX_VALUE), undefined);
  assertThrows(() => indicator.moment(Number.MAX_VALUE), RangeError);
  assertThrows(() => indicator.next(Number.MAX_VALUE), RangeError);

  assertBandsAlmostEqual(
    assertDefined(indicator.next(-Number.MAX_VALUE)),
    assertDefined(control.next(-Number.MAX_VALUE)),
  );
});

Deno.test('BollingerBands with period one collapse onto the latest close', () => {
  const indicator = new BollingerBands({ period: 1 });

  assertBandsAlmostEqual(assertDefined(indicator.next(187.42)), {
    lower: 187.42,
    middle: 187.42,
    upper: 187.42,
  });
  assertBandsAlmostEqual(assertDefined(indicator.moment(188.11)), {
    lower: 188.11,
    middle: 188.11,
    upper: 188.11,
  });
});

function referenceBands(
  values: readonly number[],
  period: number,
  standardDeviations: number,
): ReadonlyArray<BollingerBandsResult | undefined> {
  const means = referenceSma(values, period);

  return values.map((_, index) => {
    if (index + 1 < period) {
      return undefined;
    }

    const window = values.slice(index + 1 - period, index + 1);
    const middle = assertDefinedNumber(means[index]);
    const deviation = populationDeviation(window);

    return {
      lower: middle - (deviation * standardDeviations),
      middle,
      upper: middle + (deviation * standardDeviations),
    };
  });
}

function assertBandsAlmostEqual(actual: BollingerBandsResult, expected: BollingerBandsResult): void {
  assertAlmostEquals(actual.lower, expected.lower, 1e-10);
  assertAlmostEquals(actual.middle, expected.middle, 1e-10);
  assertAlmostEquals(actual.upper, expected.upper, 1e-10);
}
