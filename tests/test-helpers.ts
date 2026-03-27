import { assertExists } from '@std/assert';

export function assertDefined<T>(value: T | undefined): T {
  assertExists(value);
  return value as T;
}

export function assertDefinedNumber(value: number | undefined): number {
  return assertDefined(value);
}
