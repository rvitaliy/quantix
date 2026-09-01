import { assertAlmostEquals, assertStrictEquals, assertThrows } from '@std/assert';

import { SMA } from '../../mod.ts';
import { closeGenerator, CLOSES } from '../fixtures/daily-closes.ts';
import { assertDefinedNumber, assertOptionalNumberSeriesAlmostEquals, referenceSma } from '../test-helpers.ts';

Deno.test('SMA matches an independent rolling-mean reference on daily closes', () => {
  const period = 14;
  const actual = SMA.from(CLOSES);

  assertOptionalNumberSeriesAlmostEquals(actual, referenceSma(CLOSES, period));
});

Deno.test('SMA moment can complete warm-up without committing the indicative close', () => {
  const period = 5;
  const indicator = new SMA({ period });
  const committedCloses = CLOSES.slice(0, period - 1);
  const indicativeClose = CLOSES[period - 1]!;

  for (const close of committedCloses) {
    assertStrictEquals(indicator.next(close), undefined);
  }

  const expected = assertDefinedNumber(referenceSma([...committedCloses, indicativeClose], period).at(-1));
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expected);
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expected);
  assertAlmostEquals(assertDefinedNumber(indicator.next(indicativeClose)), expected);
});

Deno.test('SMA moment leaves an established rolling window unchanged', () => {
  const period = 5;
  const committedCloses = CLOSES.slice(0, 8);
  const indicativeClose = 190.55;
  const officialClose = CLOSES[8]!;
  const indicator = new SMA({ period });
  const control = new SMA({ period });

  for (const close of committedCloses) {
    indicator.next(close);
    control.next(close);
  }

  const expectedProjection = assertDefinedNumber(referenceSma([...committedCloses, indicativeClose], period).at(-1));
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)), expectedProjection);
  assertAlmostEquals(assertDefinedNumber(indicator.next(officialClose)), assertDefinedNumber(control.next(officialClose)));
});

Deno.test('SMA moment uses the same periodic rebase as next', () => {
  const indicator = new SMA({ period: 3 });
  const committedValues = [1e300, 1e170, -1e300, 1e300, 0] as const;

  for (const value of committedValues) {
    indicator.next(value);
  }

  assertStrictEquals(indicator.moment(-1e300), 0);
  assertStrictEquals(indicator.moment(-1e300), 0);
  assertStrictEquals(indicator.next(-1e300), 0);
});

Deno.test('SMA repeated moment stays consistent when next schedules maintenance', () => {
  const indicator = new SMA({ period: 3 });

  for (const value of [10, 20, 30, 40, 50]) {
    indicator.next(value);
  }

  assertStrictEquals(indicator.moment(60), 50);
  assertStrictEquals(indicator.moment(60), 50);
  assertStrictEquals(indicator.next(60), 50);
  assertStrictEquals(indicator.moment(70), 60);
});

Deno.test('SMA.from consumes a one-shot generator', () => {
  const period = 20;

  assertOptionalNumberSeriesAlmostEquals(
    SMA.from(closeGenerator(), { period }),
    referenceSma(CLOSES, period),
  );
});

Deno.test('SMA rejects unsafe periods and invalid observations without changing state', () => {
  assertThrows(() => new SMA({ period: Number.MAX_SAFE_INTEGER + 1 }));
  assertThrows(() => new SMA({ period: null as unknown as number }));

  const period = 5;
  const indicator = new SMA({ period });
  const control = new SMA({ period });
  for (const close of CLOSES.slice(0, period)) {
    indicator.next(close);
    control.next(close);
  }

  assertThrows(() => indicator.next(Number.NaN));
  assertThrows(() => indicator.moment(Number.POSITIVE_INFINITY));

  const nextClose = CLOSES[period]!;
  assertAlmostEquals(assertDefinedNumber(indicator.next(nextClose)), assertDefinedNumber(control.next(nextClose)));
});

Deno.test('SMA remains finite across a long constant series at the numeric limit', () => {
  const period = 14;
  const indicator = new SMA({ period });

  for (let index = 0; index < 2_000; index += 1) {
    const expected = index + 1 < period ? undefined : Number.MAX_VALUE;
    assertStrictEquals(indicator.next(Number.MAX_VALUE), expected);
  }

  assertStrictEquals(indicator.moment(Number.MAX_VALUE), Number.MAX_VALUE);
});

Deno.test('SMA seeds a balanced extreme window without residual drift', () => {
  const period = 14;
  const indicator = new SMA({ period });

  for (let index = 0; index < period - 1; index += 1) {
    const value = index % 2 === 0 ? Number.MAX_VALUE : -Number.MAX_VALUE;
    assertStrictEquals(indicator.next(value), undefined);
  }

  assertStrictEquals(indicator.moment(-Number.MAX_VALUE), 0);
  assertStrictEquals(indicator.moment(-Number.MAX_VALUE), 0);
  assertStrictEquals(indicator.next(-Number.MAX_VALUE), 0);

  assertStrictEquals(indicator.moment(Number.MAX_VALUE), 0);
  assertStrictEquals(indicator.next(Number.MAX_VALUE), 0);
});

Deno.test('SMA rebuilds an extreme rolling average before finite rounding overflows', () => {
  const indicator = new SMA({ period: 2 });
  const extreme = -Number.MAX_VALUE;
  const nearby = -0.9 * Number.MAX_VALUE;

  assertStrictEquals(indicator.next(extreme), undefined);
  assertStrictEquals(Number.isFinite(assertDefinedNumber(indicator.next(nearby))), true);
  assertStrictEquals(Number.isFinite(assertDefinedNumber(indicator.next(extreme))), true);
  assertStrictEquals(indicator.moment(extreme), extreme);
  assertStrictEquals(indicator.next(extreme), extreme);

  const recovered = assertDefinedNumber(indicator.next(nearby));
  assertStrictEquals(Number.isFinite(recovered), true);
  assertAlmostEquals(recovered / (-0.95 * Number.MAX_VALUE), 1, 1e-12);
});

Deno.test('SMA preserves a tiny residual after extreme values cancel', () => {
  const indicator = new SMA({ period: 3 });
  indicator.next(1e300);
  indicator.next(1e170);
  indicator.next(-1e170);

  const indicativeClose = -2e-170;
  const expected = indicativeClose / 3;

  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)) / expected, 1, 1e-12);
  assertAlmostEquals(assertDefinedNumber(indicator.moment(indicativeClose)) / expected, 1, 1e-12);
  assertAlmostEquals(assertDefinedNumber(indicator.next(indicativeClose)) / expected, 1, 1e-12);
});

Deno.test('SMA removes chained positive outliers without retaining their rounding residue', () => {
  const period = 14;
  const indicator = new SMA({ period });
  const seed = [
    8.122117227603878e171,
    0,
    0,
    0,
    4.892104123387839e167,
    0,
    0,
    1.0144485467087868e162,
    0,
    0,
    0,
    1.3100024844953685e105,
    0,
    0,
  ] as const;

  for (const value of seed) {
    indicator.next(value);
  }

  let actual = 0;
  for (let index = 0; index < 8; index += 1) {
    const projected = assertDefinedNumber(indicator.moment(0));
    actual = assertDefinedNumber(indicator.next(0));
    assertStrictEquals(projected, actual);
  }

  const expected = 1.3100024844953685e105 / period;
  assertAlmostEquals(actual / expected, 1, 1e-12);
});

Deno.test('SMA with period one follows the latest close', () => {
  const indicator = new SMA({ period: 1 });

  assertStrictEquals(indicator.next(187.42), 187.42);
  assertStrictEquals(indicator.moment(188.11), 188.11);
  assertStrictEquals(indicator.next(187.36), 187.36);
  assertStrictEquals(indicator.next(-1e300), -1e300);
  assertStrictEquals(indicator.moment(1e170), 1e170);
  assertStrictEquals(indicator.next(1e170), 1e170);
});
