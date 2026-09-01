/** Projects `current` toward `value` by `1 / divisor` without avoidable overflow. */
export function projectWeightedAverage(current: number, value: number, divisor: number): number {
  if (divisor === 1) {
    return value;
  }

  const difference = value - current;

  if (Number.isFinite(difference)) {
    return current + (difference / divisor);
  }

  return (current - (current / divisor)) + (value / divisor);
}
