import { assertAlmostEquals, assertStrictEquals, assertThrows } from '@std/assert';

import { RSI } from '../../mod.ts';
import { closeGenerator, CLOSES } from '../fixtures/daily-closes.ts';
import { assertDefinedNumber, assertOptionalNumberSeriesAlmostEquals, referenceRsi } from '../test-helpers.ts';

Deno.test('RSI matches an independent Wilder reference on daily closes', () => {
  const period = 14;
  const actual = RSI.from(CLOSES);

  assertOptionalNumberSeriesAlmostEquals(actual, referenceRsi(CLOSES, period));
  for (const value of actual) {
    if (value !== undefined) {
      assertStrictEquals(value >= 0 && value <= 100, true);
    }
  }
});

Deno.test('RSI moment can complete the seed period without committing', () => {
  const period = 5;
  const indicator = new RSI({ period });
  const committedCloses = CLOSES.slice(0, period);
  const indicativeClose = CLOSES[period]!;

  for (const close of committedCloses) {
    assertStrictEquals(indicator.next(close), undefined);
  }

  const expected = assertDefinedNumber(referenceRsi([...committedCloses, indicativeClose], period).at(-1));
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expected);
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expected);
  assertAlmostEquals(assertDefinedNumber(indicator.next(indicativeClose)), expected);
});

Deno.test('RSI moment leaves established Wilder averages unchanged', () => {
  const period = 5;
  const committedCloses = CLOSES.slice(0, 9);
  const indicativeClose = 190.55;
  const officialClose = CLOSES[9]!;
  const indicator = new RSI({ period });
  const control = new RSI({ period });

  for (const close of committedCloses) {
    indicator.next(close);
    control.next(close);
  }

  const expectedProjection = assertDefinedNumber(referenceRsi([...committedCloses, indicativeClose], period).at(-1));
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expectedProjection);
  assertAlmostEquals(assertDefinedNumber(indicator.next(officialClose)), assertDefinedNumber(control.next(officialClose)));
});

Deno.test('RSI.from consumes a one-shot generator', () => {
  const period = 10;

  assertOptionalNumberSeriesAlmostEquals(
    RSI.from(closeGenerator(), { period }),
    referenceRsi(CLOSES, period),
  );
});

Deno.test('RSI returns neutral 50 for a flat market and bounds directional markets', () => {
  const flatCloses = [101.25, 101.25, 101.25, 101.25, 101.25, 101.25] as const;
  const risingCloses = [101.25, 101.48, 101.91, 102.14, 102.67, 102.83] as const;
  const fallingCloses = [101.25, 101.02, 100.81, 100.44, 100.17, 99.86] as const;

  assertStrictEquals(RSI.from(flatCloses, { period: 5 }).at(-1), 50);
  assertStrictEquals(RSI.from(risingCloses, { period: 5 }).at(-1), 100);
  assertStrictEquals(RSI.from(fallingCloses, { period: 5 }).at(-1), 0);
});

Deno.test('RSI rejects unsafe periods and invalid observations without changing state', () => {
  assertThrows(() => new RSI({ period: Number.MAX_SAFE_INTEGER + 1 }));
  assertThrows(() => new RSI({ period: null as unknown as number }));

  const period = 5;
  const indicator = new RSI({ period });
  const control = new RSI({ period });
  for (const close of CLOSES.slice(0, period + 2)) {
    indicator.next(close);
    control.next(close);
  }

  assertThrows(() => indicator.next(Number.NaN));
  assertThrows(() => indicator.moment(Number.POSITIVE_INFINITY));

  const nextClose = CLOSES[period + 2]!;
  assertAlmostEquals(assertDefinedNumber(indicator.next(nextClose)), assertDefinedNumber(control.next(nextClose)));
});

Deno.test('RSI rejects an unrepresentable finite price change atomically', () => {
  const indicator = new RSI({ period: 2 });
  const control = new RSI({ period: 2 });

  assertStrictEquals(indicator.next(Number.MAX_VALUE), undefined);
  assertStrictEquals(control.next(Number.MAX_VALUE), undefined);
  assertThrows(() => indicator.next(-Number.MAX_VALUE));

  const recoveryCloses = [Number.MAX_VALUE * 0.75, Number.MAX_VALUE * 0.8] as const;
  for (const close of recoveryCloses) {
    const actual = indicator.next(close);
    const expected = control.next(close);

    if (expected === undefined) {
      assertStrictEquals(actual, undefined);
    } else {
      assertAlmostEquals(assertDefinedNumber(actual), expected);
    }
  }
});

Deno.test('RSI with period one reacts to the latest price change', () => {
  const indicator = new RSI({ period: 1 });

  assertStrictEquals(indicator.next(187.42), undefined);
  assertStrictEquals(indicator.moment(188.11), 100);
  assertStrictEquals(indicator.next(187.36), 0);
  assertStrictEquals(indicator.next(187.36), 50);

  const extreme = new RSI({ period: 1 });
  assertStrictEquals(extreme.next(-Number.MAX_VALUE), undefined);
  assertStrictEquals(extreme.next(0), 100);
  assertStrictEquals(extreme.moment(1e170), 100);
  assertStrictEquals(extreme.next(1e170), 100);
});
