import { assertAlmostEquals, assertEquals } from '@std/assert';

import { SMA, StandardDeviation } from '../../mod.ts';

const DEFAULT_SD_INPUT = Array.from({ length: 25 }, (_, index) => index + 1);
const GOLDEN_SD_OUTPUT = [
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  Number.NaN,
  5.766281297335398,
  5.766281297335398,
  5.766281297335398,
  5.766281297335398,
  5.766281297335398,
  5.766281297335398,
] as const;

Deno.test('StandardDeviation computes population deviation for the default window', () => {
  const movingAverage = new SMA({ period: 20 });
  const indicator = new StandardDeviation();
  let deviation = Number.NaN;

  for (const value of DEFAULT_SD_INPUT) {
    const mean = movingAverage.next(value);
    deviation = indicator.next(value, mean);
  }

  assertAlmostEquals(deviation, 5.766281297335398);
});

Deno.test('StandardDeviation moment projects without mutating the committed window', () => {
  const movingAverage = new SMA({ period: 20 });
  const indicator = new StandardDeviation();

  for (const value of DEFAULT_SD_INPUT.slice(0, 20)) {
    const mean = movingAverage.next(value);
    indicator.next(value, mean);
  }

  const projectedMean = movingAverage.moment(21);
  const committedMean = movingAverage.next(21);
  const projected = indicator.moment(21, projectedMean);
  const committed = indicator.next(21, committedMean);

  assertAlmostEquals(projected, committed);
});

Deno.test('StandardDeviation matches the golden reference series', () => {
  const movingAverage = new SMA({ period: 20 });
  const deviation = new StandardDeviation();
  const values = DEFAULT_SD_INPUT.map((value) => {
    const mean = movingAverage.next(value);
    return deviation.next(value, mean);
  });

  assertEquals(values.length, GOLDEN_SD_OUTPUT.length);

  for (let index = 0; index < values.length; index += 1) {
    const actual = values[index];
    const expected = GOLDEN_SD_OUTPUT[index];

    if (Number.isNaN(expected) === true) {
      assertEquals(Number.isNaN(actual), true);
      continue;
    }

    assertAlmostEquals(actual, expected);
  }
});
