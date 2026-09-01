export function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer, received ${value}`);
  }
}

export function assertNonNegativeFiniteNumber(name: string, value: number): void {
  assertFiniteNumber(name, value);

  if (value < 0) {
    throw new RangeError(`${name} must be non-negative, received ${value}`);
  }
}

export function assertFiniteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number, received ${value}`);
  }
}
