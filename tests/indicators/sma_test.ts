import { assertAlmostEquals, assertEquals } from '@std/assert';

import { SMA, sma } from '../../mod.ts';

const DEFAULT_SMA_INPUT = Array.from({ length: 25 }, (_, index) => index + 1);
const GOLDEN_SMA_OUTPUT = [
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
  7.5,
  8.5,
  9.5,
  10.5,
  11.5,
  12.5,
  13.5,
  14.5,
  15.5,
  16.5,
  17.5,
  18.5,
] as const;

Deno.test('SMA emits undefined until the default window is full', () => {
  const indicator = new SMA();
  const results = DEFAULT_SMA_INPUT.map((value) => indicator.next(value));

  assertEquals(results.slice(0, 13), new Array(13).fill(undefined));
  assertAlmostEquals(results[13]!, 7.5);
});

Deno.test('SMA moment projects without mutating the committed average', () => {
  const indicator = new SMA();

  for (const value of DEFAULT_SMA_INPUT.slice(0, 14)) {
    indicator.next(value);
  }

  const projected = indicator.moment(15);
  const committed = indicator.next(15);

  assertAlmostEquals(projected!, committed!);
});

Deno.test('sma computes a full series', () => {
  const values = sma(DEFAULT_SMA_INPUT);

  assertEquals(values.length, DEFAULT_SMA_INPUT.length);
  assertAlmostEquals(values[13]!, 7.5);
  assertAlmostEquals(values[24]!, 18.5);
});

Deno.test('SMA matches the golden reference series', () => {
  const values = sma(DEFAULT_SMA_INPUT);

  assertEquals(values, [...GOLDEN_SMA_OUTPUT]);
});
