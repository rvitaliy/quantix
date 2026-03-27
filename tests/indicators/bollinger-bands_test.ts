import { assertAlmostEquals, assertEquals } from '@std/assert';

import { BollingerBands, bollingerBands } from '../../mod.ts';
import { assertDefined, assertDefinedNumber } from '../test-helpers.ts';

const GOLDEN_BB_VALUES = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  { lower: -1.0325625946707966, middle: 10.5, upper: 22.032562594670797 },
  { lower: -0.032562594670796585, middle: 11.5, upper: 23.032562594670797 },
  { lower: 0.9674374053292034, middle: 12.5, upper: 24.032562594670797 },
  { lower: 1.9674374053292034, middle: 13.5, upper: 25.032562594670797 },
  { lower: 2.9674374053292034, middle: 14.5, upper: 26.032562594670797 },
  { lower: 3.9674374053292034, middle: 15.5, upper: 27.032562594670797 },
] as const;

Deno.test('BollingerBands emits undefined until the window is full', () => {
  const indicator = new BollingerBands();

  for (let value = 1; value < 20; value += 1) {
    assertEquals(indicator.next(value), undefined);
  }

  const value = assertDefined(indicator.next(20));
  assertAlmostEquals(assertDefinedNumber(value.middle), 10.5);
  assertAlmostEquals(value.upper, 22.032562594670797);
  assertAlmostEquals(value.lower, -1.0325625946707966);
});

Deno.test('BollingerBands moment projects without mutating the stream', () => {
  const indicator = new BollingerBands();

  for (let value = 1; value <= 20; value += 1) {
    indicator.next(value);
  }

  const projected = assertDefined(indicator.moment(21));
  const committed = assertDefined(indicator.next(21));

  assertAlmostEquals(assertDefinedNumber(projected.middle), assertDefinedNumber(committed.middle));
  assertAlmostEquals(projected.upper, committed.upper);
  assertAlmostEquals(projected.lower, committed.lower);
});

Deno.test('bollingerBands computes a full series', () => {
  const series = bollingerBands(Array.from({ length: 25 }, (_, index) => index + 1));

  assertEquals(series.slice(0, 19), new Array(19).fill(undefined));
  const twentieth = assertDefined(series[19]);
  const twentyFirst = assertDefined(series[20]);
  assertAlmostEquals(assertDefinedNumber(twentieth.middle), 10.5);
  assertAlmostEquals(assertDefinedNumber(twentyFirst.middle), 11.5);
});

Deno.test('BollingerBands matches the golden reference series', () => {
  const values = bollingerBands(Array.from({ length: 25 }, (_, index) => index + 1));

  assertEquals(values.length, GOLDEN_BB_VALUES.length);

  for (let index = 0; index < values.length; index += 1) {
    const actual = values[index];
    const expected = GOLDEN_BB_VALUES[index];

    if (expected === undefined) {
      assertEquals(actual, undefined);
      continue;
    }

    const actualBands = assertDefined(actual);
    assertAlmostEquals(actualBands.lower, expected.lower);
    assertAlmostEquals(assertDefinedNumber(actualBands.middle), expected.middle);
    assertAlmostEquals(actualBands.upper, expected.upper);
  }
});
