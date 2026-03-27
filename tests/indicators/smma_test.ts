import { assertAlmostEquals, assertEquals } from '@std/assert';

import { SMMA, smma } from '../../mod.ts';

const DEFAULT_SMMA_INPUT = Array.from({ length: 25 }, (_, index) => index + 1);
const GOLDEN_SMMA_OUTPUT = [
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
  8.035714285714286,
  8.604591836734695,
  9.204263848396502,
  9.832530716368181,
  10.48734995091331,
  11.166824954419502,
  11.869194600532394,
  12.592823557637223,
  13.336193303520277,
  14.097893781840257,
  14.876615654565953,
] as const;

Deno.test('SMMA seeds with the default average and then smooths forward', () => {
  const indicator = new SMMA();
  const results = DEFAULT_SMMA_INPUT.map((value) => indicator.next(value));

  assertEquals(results.slice(0, 13), new Array(13).fill(undefined));
  assertAlmostEquals(results[13]!, 7.5);
  assertAlmostEquals(results[14]!, 8.035714285714286);
});

Deno.test('SMMA moment projects without mutating the committed average', () => {
  const indicator = new SMMA();

  for (const value of DEFAULT_SMMA_INPUT.slice(0, 14)) {
    indicator.next(value);
  }

  const projected = indicator.moment(15);
  const committed = indicator.next(15);

  assertAlmostEquals(projected!, committed!);
});

Deno.test('smma computes a full series', () => {
  const values = smma(DEFAULT_SMMA_INPUT);

  assertEquals(values.length, DEFAULT_SMMA_INPUT.length);
  assertAlmostEquals(values[13]!, 7.5);
  assertAlmostEquals(values[24]!, 14.876615654565953);
});

Deno.test('SMMA matches the golden reference series', () => {
  const values = smma(DEFAULT_SMMA_INPUT);

  assertEquals(values, [...GOLDEN_SMMA_OUTPUT]);
});
