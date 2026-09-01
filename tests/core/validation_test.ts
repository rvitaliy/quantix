import { assertThrows } from '@std/assert';

import { assertFiniteNumber, assertPositiveInteger } from '../../src/core/validation.ts';

Deno.test('assertPositiveInteger accepts practical and safely representable periods', () => {
  assertPositiveInteger('period', 1);
  assertPositiveInteger('period', 14);
  assertPositiveInteger('period', 20);
  assertPositiveInteger('period', 252);
  assertPositiveInteger('period', Number.MAX_SAFE_INTEGER);
});

Deno.test('assertPositiveInteger rejects non-positive, fractional, non-finite, and unsafe periods', () => {
  for (
    const period of [
      0,
      -1,
      14.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]
  ) {
    assertThrows(() => assertPositiveInteger('period', period), RangeError);
  }
});

Deno.test('assertFiniteNumber accepts realistic closes and numeric boundary values', () => {
  assertFiniteNumber('close', 0);
  assertFiniteNumber('close', 187.42);
  assertFiniteNumber('close', -0.01);
  assertFiniteNumber('close', Number.MAX_VALUE);
  assertFiniteNumber('close', -Number.MAX_VALUE);
});

Deno.test('assertFiniteNumber rejects NaN and infinities', () => {
  assertThrows(() => assertFiniteNumber('close', Number.NaN), TypeError);
  assertThrows(() => assertFiniteNumber('close', Number.POSITIVE_INFINITY), TypeError);
  assertThrows(() => assertFiniteNumber('close', Number.NEGATIVE_INFINITY), TypeError);
});
