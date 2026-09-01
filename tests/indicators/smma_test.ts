import { assertAlmostEquals, assertStrictEquals, assertThrows } from '@std/assert';

import { SMMA } from '../../mod.ts';
import { closeGenerator, CLOSES } from '../fixtures/daily-closes.ts';
import { assertDefinedNumber, assertOptionalNumberSeriesAlmostEquals, referenceSmma } from '../test-helpers.ts';

Deno.test('SMMA matches an independent Wilder-smoothing reference on daily closes', () => {
  const period = 14;

  assertOptionalNumberSeriesAlmostEquals(
    SMMA.from(CLOSES),
    referenceSmma(CLOSES, period),
  );
});

Deno.test('SMMA moment can project the close that completes its seed', () => {
  const period = 5;
  const indicator = new SMMA({ period });
  const committedCloses = CLOSES.slice(0, period - 1);
  const indicativeClose = CLOSES[period - 1]!;

  for (const close of committedCloses) {
    assertStrictEquals(indicator.next(close), undefined);
  }

  const expected = assertDefinedNumber(referenceSmma([...committedCloses, indicativeClose], period).at(-1));
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expected);
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expected);
  assertAlmostEquals(assertDefinedNumber(indicator.next(indicativeClose)), expected);
});

Deno.test('SMMA moment leaves established Wilder smoothing unchanged', () => {
  const period = 5;
  const committedCloses = CLOSES.slice(0, 8);
  const indicativeClose = 190.55;
  const officialClose = CLOSES[8]!;
  const indicator = new SMMA({ period });
  const control = new SMMA({ period });

  for (const close of committedCloses) {
    indicator.next(close);
    control.next(close);
  }

  const expectedProjection = assertDefinedNumber(referenceSmma([...committedCloses, indicativeClose], period).at(-1));
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expectedProjection);
  assertAlmostEquals(assertDefinedNumber(indicator.next(officialClose)), assertDefinedNumber(control.next(officialClose)));
});

Deno.test('SMMA.from consumes a one-shot generator', () => {
  const period = 10;

  assertOptionalNumberSeriesAlmostEquals(
    SMMA.from(closeGenerator(), { period }),
    referenceSmma(CLOSES, period),
  );
});

Deno.test('SMMA rejects unsafe periods and invalid observations without changing state', () => {
  assertThrows(() => new SMMA({ period: Number.MAX_SAFE_INTEGER + 1 }));
  assertThrows(() => new SMMA({ period: null as unknown as number }));

  const period = 5;
  const indicator = new SMMA({ period });
  const control = new SMMA({ period });
  for (const close of CLOSES.slice(0, period + 2)) {
    indicator.next(close);
    control.next(close);
  }

  assertThrows(() => indicator.next(Number.NEGATIVE_INFINITY));
  assertThrows(() => indicator.moment(Number.NaN));

  const nextClose = CLOSES[period + 2]!;
  assertAlmostEquals(assertDefinedNumber(indicator.next(nextClose)), assertDefinedNumber(control.next(nextClose)));
});

Deno.test('SMMA remains finite across a long constant series at the numeric limit', () => {
  const period = 14;
  const indicator = new SMMA({ period });

  for (let index = 0; index < 2_000; index += 1) {
    const expected = index + 1 < period ? undefined : Number.MAX_VALUE;
    assertStrictEquals(indicator.next(Number.MAX_VALUE), expected);
  }

  assertStrictEquals(indicator.moment(Number.MAX_VALUE), Number.MAX_VALUE);
});

Deno.test('SMMA with period one follows each new close', () => {
  const indicator = new SMMA({ period: 1 });

  assertStrictEquals(indicator.next(187.42), 187.42);
  assertStrictEquals(indicator.moment(188.11), 188.11);
  assertStrictEquals(indicator.next(187.36), 187.36);
  assertStrictEquals(indicator.next(-1e300), -1e300);
  assertStrictEquals(indicator.moment(1e170), 1e170);
  assertStrictEquals(indicator.next(1e170), 1e170);
});
