import { assertAlmostEquals, assertEquals, assertStrictEquals } from '@std/assert';

import { RSI, rsi } from '../../mod.ts';

const GOLDEN_RSI_PRICES = [
  44,
  44.15,
  43.9,
  44.35,
  44.2,
  44.35,
  44.6,
  45.1,
  44.9,
  45.3,
  45.05,
  45.4,
  45.7,
  45.6,
  45.9,
  46.2,
  46.1,
  46.4,
  46.7,
  46.5,
  46.8,
  47.1,
  47,
  47.3,
] as const;

const GOLDEN_RSI_VALUES = [
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
  74.99999999999996,
  76.95895522388058,
  74.85343383584585,
  76.89564342370066,
  78.75382070929109,
  74.45470775342012,
  76.52481212514114,
  78.40905827125744,
  76.21311213162622,
  78.18680955959007,
] as const;

Deno.test('RSI uses Wilder smoothing after the seed period', () => {
  const indicator = new RSI();
  const prices = GOLDEN_RSI_PRICES;
  const results = prices.map((price) => indicator.next(price));

  assertEquals(results.slice(0, 14), new Array(14).fill(undefined));
  assertAlmostEquals(results[14]!, 74.99999999999996);
  assertAlmostEquals(results[15]!, 76.95895522388058);
});

Deno.test('RSI moment projects without mutating internal state', () => {
  const indicator = new RSI();

  for (const price of GOLDEN_RSI_PRICES.slice(0, 16)) {
    indicator.next(price);
  }

  const projected = indicator.moment(46.4);
  const committed = indicator.next(46.4);

  assertStrictEquals(projected, committed);
});

Deno.test('rsi computes a full series', () => {
  const values = rsi(GOLDEN_RSI_PRICES);

  assertEquals(values.length, GOLDEN_RSI_PRICES.length);
  assertAlmostEquals(values[14]!, 74.99999999999996);
  assertAlmostEquals(values[23]!, 78.18680955959007);
});

Deno.test('RSI matches the golden reference series', () => {
  const values = rsi(GOLDEN_RSI_PRICES, { period: 14 });

  assertEquals(values.length, GOLDEN_RSI_VALUES.length);

  for (let index = 0; index < values.length; index += 1) {
    const actual = values[index];
    const expected = GOLDEN_RSI_VALUES[index];

    if (expected === undefined) {
      assertStrictEquals(actual, undefined);
      continue;
    }

    assertAlmostEquals(actual!, expected);
  }
});
