import { assertThrows } from '@std/assert';

import { assertFiniteNumber, assertPositiveInteger } from '../../src/core/validation.ts';

Deno.test('assertPositiveInteger accepts valid positive integers', () => {
  assertPositiveInteger('period', 1);
  assertPositiveInteger('period', 20);
});

Deno.test('assertPositiveInteger rejects invalid values', () => {
  assertThrows(() => assertPositiveInteger('period', 0), RangeError, 'period must be a positive integer');
  assertThrows(() => assertPositiveInteger('period', -1), RangeError, 'period must be a positive integer');
  assertThrows(() => assertPositiveInteger('period', 1.5), RangeError, 'period must be a positive integer');
});

Deno.test('assertFiniteNumber accepts finite numbers', () => {
  assertFiniteNumber('value', 0);
  assertFiniteNumber('value', 42.5);
  assertFiniteNumber('value', -10);
});

Deno.test('assertFiniteNumber rejects NaN and infinities', () => {
  assertThrows(() => assertFiniteNumber('value', Number.NaN), TypeError, 'value must be a finite number');
  assertThrows(() => assertFiniteNumber('value', Number.POSITIVE_INFINITY), TypeError, 'value must be a finite number');
  assertThrows(() => assertFiniteNumber('value', Number.NEGATIVE_INFINITY), TypeError, 'value must be a finite number');
});
