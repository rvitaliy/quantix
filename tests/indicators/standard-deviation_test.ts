import { assertAlmostEquals, assertStrictEquals, assertThrows } from '@std/assert';

import { StandardDeviation } from '../../mod.ts';
import { closeGenerator, CLOSES } from '../fixtures/daily-closes.ts';
import { assertDefinedNumber, assertOptionalNumberSeriesAlmostEquals, populationDeviation, referenceStandardDeviation } from '../test-helpers.ts';

Deno.test('StandardDeviation matches an independent population-deviation reference', () => {
  const period = 20;

  assertOptionalNumberSeriesAlmostEquals(
    StandardDeviation.from(CLOSES),
    referenceStandardDeviation(CLOSES, period),
  );
});

Deno.test('StandardDeviation moment can complete warm-up without committing', () => {
  const period = 5;
  const indicator = new StandardDeviation({ period });
  const committedCloses = CLOSES.slice(0, period - 1);
  const indicativeClose = CLOSES[period - 1]!;

  for (const close of committedCloses) {
    assertStrictEquals(indicator.next(close), undefined);
  }

  const expected = populationDeviation([...committedCloses, indicativeClose]);
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expected);
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expected);
  assertAlmostEquals(assertDefinedNumber(indicator.next(indicativeClose)), expected);
});

Deno.test('StandardDeviation moment leaves an established rolling window unchanged', () => {
  const period = 5;
  const committedCloses = CLOSES.slice(0, 8);
  const indicativeClose = 190.55;
  const officialClose = CLOSES[8]!;
  const indicator = new StandardDeviation({ period });
  const control = new StandardDeviation({ period });

  for (const close of committedCloses) {
    indicator.next(close);
    control.next(close);
  }

  const expectedProjection = populationDeviation([...committedCloses.slice(1 - period), indicativeClose]);
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expectedProjection);
  assertAlmostEquals(assertDefinedNumber(indicator.next(officialClose)), assertDefinedNumber(control.next(officialClose)));
});

Deno.test('StandardDeviation moment matches next when the rolling origin leaves the window', () => {
  const period = 3;
  const committed = [
    0,
    999_999.999,
    1_000_000.001,
    999_999.999,
    1_000_000.001,
  ] as const;
  const candidate = 999_999.999;
  const indicator = new StandardDeviation({ period });
  const control = new StandardDeviation({ period });

  for (const value of committed) {
    indicator.next(value);
    control.next(value);
  }

  const projected = assertDefinedNumber(indicator.moment(candidate));
  const expected = assertDefinedNumber(control.next(candidate));

  assertStrictEquals(projected, expected);
  assertStrictEquals(assertDefinedNumber(indicator.next(candidate)), expected);
});

Deno.test('StandardDeviation.from consumes a one-shot generator', () => {
  const period = 10;

  assertOptionalNumberSeriesAlmostEquals(
    StandardDeviation.from(closeGenerator(), { period }),
    referenceStandardDeviation(CLOSES, period),
  );
});

Deno.test('StandardDeviation rejects unsafe periods and invalid observations without changing state', () => {
  assertThrows(() => new StandardDeviation({ period: Number.MAX_SAFE_INTEGER + 1 }));
  assertThrows(() => new StandardDeviation({ period: null as unknown as number }));

  const period = 5;
  const indicator = new StandardDeviation({ period });
  const control = new StandardDeviation({ period });
  for (const close of CLOSES.slice(0, period + 2)) {
    indicator.next(close);
    control.next(close);
  }

  assertThrows(() => indicator.next(Number.NaN));
  assertThrows(() => indicator.moment(Number.POSITIVE_INFINITY));

  const nextClose = CLOSES[period + 2]!;
  assertAlmostEquals(assertDefinedNumber(indicator.next(nextClose)), assertDefinedNumber(control.next(nextClose)));
});

Deno.test('StandardDeviation remains finite when a large population deviation is representable', () => {
  const indicator = new StandardDeviation({ period: 2 });
  const lowerClose = 8e299;
  const upperClose = 1.2e300;
  const expected = 2e299;

  assertStrictEquals(indicator.next(lowerClose), undefined);
  const actual = assertDefinedNumber(indicator.next(upperClose));
  assertStrictEquals(Number.isFinite(actual), true);
  assertAlmostEquals(actual / expected, 1, 1e-12);
});

Deno.test('StandardDeviation preserves a representable deviation when squared distances underflow', () => {
  const indicator = new StandardDeviation({ period: 2 });
  const expected = 1e-170;

  assertStrictEquals(indicator.next(0), undefined);
  assertAlmostEquals(assertDefinedNumber(indicator.moment(2e-170)) / expected, 1, 1e-12);
  assertAlmostEquals(assertDefinedNumber(indicator.next(2e-170)) / expected, 1, 1e-12);
  assertAlmostEquals(assertDefinedNumber(indicator.next(4e-170)) / expected, 1, 1e-12);
});

Deno.test('StandardDeviation avoids overflow for an unchanged maximum finite price', () => {
  const indicator = new StandardDeviation({ period: 2 });

  assertStrictEquals(indicator.next(Number.MAX_VALUE), undefined);
  assertStrictEquals(indicator.moment(Number.MAX_VALUE), 0);
  assertStrictEquals(indicator.next(Number.MAX_VALUE), 0);
});

Deno.test('StandardDeviation with period one is zero for committed and projected closes', () => {
  const indicator = new StandardDeviation({ period: 1 });

  assertStrictEquals(indicator.next(187.42), 0);
  assertStrictEquals(indicator.moment(188.11), 0);
  assertStrictEquals(indicator.next(187.36), 0);
});
