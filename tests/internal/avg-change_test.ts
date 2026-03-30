import { assertAlmostEquals, assertStrictEquals } from '@std/assert';

import { AvgChangeProvider } from '../../src/internal/avg-change.ts';
import { assertDefined } from '../test-helpers.ts';

Deno.test('AvgChangeProvider returns undefined until a previous value exists', () => {
  const provider = new AvgChangeProvider(14);

  assertStrictEquals(provider.next(44), undefined);
  assertStrictEquals(provider.moment(44.15), undefined);
  assertStrictEquals(provider.next(44.15), undefined);
});

Deno.test('AvgChangeProvider seeds gain and loss smoothing after the default period', () => {
  const provider = new AvgChangeProvider(14);
  const prices = [
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
  ] as const;

  const results = prices.map((price) => provider.next(price));
  const beforeSeed = results[13];
  const seeded = assertDefined(results[14]);

  assertStrictEquals(beforeSeed, undefined);
  assertAlmostEquals(seeded.averageGain, 0.20357142857142868);
  assertAlmostEquals(seeded.averageLoss, 0.06785714285714306);
});

Deno.test('AvgChangeProvider moment projects without mutating committed smoothing state', () => {
  const provider = new AvgChangeProvider(14);
  const prices = [
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
  ] as const;

  for (const price of prices) {
    provider.next(price);
  }

  const projected = assertDefined(provider.moment(46.1));
  const committed = assertDefined(provider.next(46.1));

  assertAlmostEquals(projected.averageGain, committed.averageGain);
  assertAlmostEquals(projected.averageLoss, committed.averageLoss);
});

Deno.test('AvgChangeProvider handles pure losses by emitting zero average gain', () => {
  const provider = new AvgChangeProvider(3);
  const prices = [10, 9, 8, 7, 6] as const;
  const results = prices.map((price) => provider.next(price));
  const latest = assertDefined(results[4]);

  assertAlmostEquals(latest.averageGain, 0);
  assertAlmostEquals(latest.averageLoss, 1);
});
