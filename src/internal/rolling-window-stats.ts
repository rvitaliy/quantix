import { RingBuffer } from '../core/ring-buffer.ts';
import { assertFiniteNumber, assertPositiveInteger } from '../core/validation.ts';

const MIN_NORMAL_NUMBER = 2 ** -1022;
const CANCELLATION_THRESHOLD = 1e-6;

/**
 * Rolling population statistics with an allocation-free O(1) normal path.
 *
 * Values are accumulated as compensated distances from a nearby origin. This
 * avoids both the cancellation of `E[x²] - E[x]²` and the removal drift of a
 * rolling Welford mean. A rare rebuild recenters the origin; when raw distances
 * overflow, a normalized representation keeps representable results finite.
 */
export class RollingWindowStats {
  readonly #period: number;
  readonly #window: RingBuffer<number>;
  #origin = 0;
  #rebaseAge = 0;
  #scale = 1;
  #scaleCount = 0;
  #scaled = false;
  #squaredSum = 0;
  #squaredSumCorrection = 0;
  #sum = 0;
  #sumCorrection = 0;
  #previewOrigin = 0;
  #previewRebaseAge = 0;
  #previewScale = 1;
  #previewScaleCount = 0;
  #previewScaled = false;
  #previewSize = 0;
  #previewSquaredSum = 0;
  #previewSquaredSumCorrection = 0;
  #previewSum = 0;
  #previewSumCorrection = 0;
  #preparedValue = 0;

  constructor(period: number) {
    assertPositiveInteger('period', period);
    this.#period = period;
    this.#window = new RingBuffer<number>(period);
  }

  get mean(): number | undefined {
    if (!this.#window.isFull) {
      return undefined;
    }

    return this.#meanValue(this.#origin, this.#sum, this.#scale, this.#scaled, this.#window.size);
  }

  get standardDeviation(): number | undefined {
    if (!this.#window.isFull) {
      return undefined;
    }

    return this.#standardDeviationValue(
      this.#sum,
      this.#squaredSum,
      this.#scale,
      this.#scaled,
      this.#window.size,
    );
  }

  get previewMean(): number | undefined {
    if (this.#previewSize < this.#period) {
      return undefined;
    }

    return this.#meanValue(
      this.#previewOrigin,
      this.#previewSum,
      this.#previewScale,
      this.#previewScaled,
      this.#previewSize,
    );
  }

  get previewStandardDeviation(): number | undefined {
    if (this.#previewSize < this.#period) {
      return undefined;
    }

    return this.#standardDeviationValue(
      this.#previewSum,
      this.#previewSquaredSum,
      this.#previewScale,
      this.#previewScaled,
      this.#previewSize,
    );
  }

  next(value: number): boolean {
    const isReady = this.prepareNext(value);
    this.commitPrepared();
    return isReady;
  }

  /** Computes and stores a transactional next state without committing it. */
  prepareNext(value: number): boolean {
    assertFiniteNumber('value', value);
    const isReady = this.#project(value);
    this.#preparedValue = value;
    return isReady;
  }

  /** Commits the state produced by the latest trusted `prepareNext` call. */
  commitPrepared(): void {
    if (
      this.#period > 1 && this.#previewSize === this.#period &&
      this.#previewRebaseAge >= this.#period - 1
    ) {
      this.#rebuildPreview(this.#preparedValue, this.#previewSize);
    }

    this.#window.push(this.#preparedValue);
    this.#origin = this.#previewOrigin;
    this.#rebaseAge = this.#previewRebaseAge;
    this.#scale = this.#previewScale;
    this.#scaleCount = this.#previewScaleCount;
    this.#scaled = this.#previewScaled;
    this.#squaredSum = this.#previewSquaredSum;
    this.#squaredSumCorrection = this.#previewSquaredSumCorrection;
    this.#sum = this.#previewSum;
    this.#sumCorrection = this.#previewSumCorrection;
  }

  preview(value: number): boolean {
    assertFiniteNumber('value', value);
    return this.#project(value);
  }

  #project(value: number): boolean {
    const size = this.#window.size;
    const projectedSize = Math.min(size + 1, this.#period);

    if (size + 1 === this.#period) {
      this.#rebuildPreview(value, projectedSize);
      return true;
    }

    const shouldRescale = this.#scaled && this.#scaleCount === 1 && size === this.#period &&
      Math.abs(this.#window.oldest()!) === this.#scale && Math.abs(value) < this.#scale;

    if (shouldRescale) {
      this.#rebuildPreview(value, projectedSize);
      return true;
    }

    const projectionSucceeded = this.#scaled ? this.#projectScaled(value, size, projectedSize) : this.#projectRaw(value, size, projectedSize);

    if (!projectionSucceeded) {
      this.#rebuildPreview(value, projectedSize, true);
    }

    return projectedSize === this.#period;
  }

  #projectRaw(value: number, size: number, projectedSize: number): boolean {
    if (size === 0) {
      this.#setPreview(value, 0, 0, 0, 0, 1, 0, false, 1, this.#rebaseAge + 1);
      return true;
    }

    const origin = this.#origin;
    let sum = this.#sum;
    let sumCorrection = this.#sumCorrection;
    let squaredSum = this.#squaredSum;
    let squaredSumCorrection = this.#squaredSumCorrection;

    if (size === this.#period) {
      const outgoingDistance = this.#window.oldest()! - origin;
      const outgoingSquare = outgoingDistance * outgoingDistance;

      if (
        !Number.isFinite(outgoingDistance) || !Number.isFinite(outgoingSquare) ||
        hasSubnormalSquare(outgoingDistance, outgoingSquare)
      ) {
        return false;
      }

      let adjustment = -outgoingDistance - sumCorrection;
      let nextSum = sum + adjustment;

      if (hasCatastrophicCancellation(sum, adjustment, nextSum)) {
        this.#rebuildPreview(value, projectedSize);
        return true;
      }

      sumCorrection = (nextSum - sum) - adjustment;
      sum = nextSum;

      adjustment = -outgoingSquare - squaredSumCorrection;
      nextSum = squaredSum + adjustment;

      if (hasCatastrophicCancellation(squaredSum, adjustment, nextSum)) {
        this.#rebuildPreview(value, projectedSize);
        return true;
      }

      squaredSumCorrection = (nextSum - squaredSum) - adjustment;
      squaredSum = nextSum;
    }

    const incomingDistance = value - origin;
    const incomingSquare = incomingDistance * incomingDistance;

    if (
      !Number.isFinite(incomingDistance) || !Number.isFinite(incomingSquare) ||
      hasSubnormalSquare(incomingDistance, incomingSquare)
    ) {
      return false;
    }

    let adjustment = incomingDistance - sumCorrection;
    let nextSum = sum + adjustment;
    sumCorrection = (nextSum - sum) - adjustment;
    sum = nextSum;

    adjustment = incomingSquare - squaredSumCorrection;
    nextSum = squaredSum + adjustment;
    squaredSumCorrection = (nextSum - squaredSum) - adjustment;
    squaredSum = nextSum;

    if (!Number.isFinite(sum) || !Number.isFinite(squaredSum)) {
      return false;
    }

    if (squaredSum < 0) {
      squaredSum = 0;
      squaredSumCorrection = 0;
    }

    this.#setPreview(
      origin,
      sum,
      sumCorrection,
      squaredSum,
      squaredSumCorrection,
      1,
      0,
      false,
      projectedSize,
      this.#rebaseAge + 1,
    );
    return true;
  }

  #projectScaled(value: number, size: number, projectedSize: number): boolean {
    let origin = this.#origin;
    let scale = this.#scale;
    let scaleCount = this.#scaleCount;
    let sum = this.#sum;
    let sumCorrection = this.#sumCorrection;
    let squaredSum = this.#squaredSum;
    let squaredSumCorrection = this.#squaredSumCorrection;
    const magnitude = Math.abs(value);

    if (magnitude > scale || scale === 0) {
      const nextScale = magnitude;
      const factor = nextScale === 0 ? 0 : scale / nextScale;
      const squaredFactor = factor * factor;
      origin *= factor;
      sum *= factor;
      sumCorrection *= factor;
      squaredSum *= squaredFactor;
      squaredSumCorrection *= squaredFactor;
      scale = nextScale;
      scaleCount = nextScale === 0 ? size : 0;
    }

    if (size === this.#period) {
      const outgoingValue = this.#window.oldest()!;
      const outgoing = scale === 0 ? 0 : outgoingValue / scale;
      const outgoingDistance = outgoing - origin;
      const outgoingSquare = outgoingDistance * outgoingDistance;

      if (Math.abs(outgoingValue) === scale) {
        scaleCount -= 1;
      }

      let adjustment = -outgoingDistance - sumCorrection;
      let nextSum = sum + adjustment;

      if (hasCatastrophicCancellation(sum, adjustment, nextSum)) {
        this.#rebuildPreview(value, projectedSize);
        return true;
      }

      sumCorrection = (nextSum - sum) - adjustment;
      sum = nextSum;

      adjustment = -outgoingSquare - squaredSumCorrection;
      nextSum = squaredSum + adjustment;

      if (hasCatastrophicCancellation(squaredSum, adjustment, nextSum)) {
        this.#rebuildPreview(value, projectedSize);
        return true;
      }

      squaredSumCorrection = (nextSum - squaredSum) - adjustment;
      squaredSum = nextSum;
    }

    const normalizedValue = scale === 0 ? 0 : value / scale;
    const incomingDistance = normalizedValue - origin;
    const incomingSquare = incomingDistance * incomingDistance;
    let adjustment = incomingDistance - sumCorrection;
    let nextSum = sum + adjustment;
    sumCorrection = (nextSum - sum) - adjustment;
    sum = nextSum;

    adjustment = incomingSquare - squaredSumCorrection;
    nextSum = squaredSum + adjustment;
    squaredSumCorrection = (nextSum - squaredSum) - adjustment;
    squaredSum = nextSum;

    if (magnitude === scale) {
      scaleCount += 1;
    }

    if (!Number.isFinite(sum) || !Number.isFinite(squaredSum)) {
      return false;
    }

    if (squaredSum < 0) {
      squaredSum = 0;
      squaredSumCorrection = 0;
    }

    this.#setPreview(
      origin,
      sum,
      sumCorrection,
      squaredSum,
      squaredSumCorrection,
      scale,
      scaleCount,
      true,
      projectedSize,
      this.#rebaseAge + 1,
    );
    return true;
  }

  #rebuildPreview(value: number, projectedSize: number, forceScaled = false): void {
    if (!forceScaled && this.#rebuildRaw(value, projectedSize)) {
      return;
    }

    let scale = Math.abs(value);
    const retainedStart = this.#window.isFull ? 1 : 0;

    for (let index = retainedStart; index < this.#window.size; index += 1) {
      scale = Math.max(scale, Math.abs(this.#window.at(index)!));
    }

    const origin = scale === 0 ? 0 : value / scale;
    let scaleCount = Math.abs(value) === scale ? 1 : 0;
    let sum = 0;
    let sumCorrection = 0;
    let squaredSum = 0;
    let squaredSumCorrection = 0;

    for (let index = retainedStart; index < this.#window.size; index += 1) {
      const retainedValue = this.#window.at(index)!;
      const current = scale === 0 ? 0 : retainedValue / scale;

      if (Math.abs(retainedValue) === scale) {
        scaleCount += 1;
      }

      const distance = current - origin;
      const square = distance * distance;
      let adjustment = distance - sumCorrection;
      let nextSum = sum + adjustment;
      sumCorrection = (nextSum - sum) - adjustment;
      sum = nextSum;

      adjustment = square - squaredSumCorrection;
      nextSum = squaredSum + adjustment;
      squaredSumCorrection = (nextSum - squaredSum) - adjustment;
      squaredSum = nextSum;
    }

    this.#setPreview(
      origin,
      sum,
      sumCorrection,
      squaredSum,
      squaredSumCorrection,
      scale,
      scaleCount,
      true,
      projectedSize,
      0,
    );
  }

  #rebuildRaw(value: number, projectedSize: number): boolean {
    const origin = value;
    let sum = 0;
    let sumCorrection = 0;
    let squaredSum = 0;
    let squaredSumCorrection = 0;
    const retainedStart = this.#window.isFull ? 1 : 0;

    for (let index = retainedStart; index < this.#window.size; index += 1) {
      const distance = this.#window.at(index)! - origin;
      const square = distance * distance;

      if (
        !Number.isFinite(distance) || !Number.isFinite(square) ||
        hasSubnormalSquare(distance, square)
      ) {
        return false;
      }

      let adjustment = distance - sumCorrection;
      let nextSum = sum + adjustment;
      sumCorrection = (nextSum - sum) - adjustment;
      sum = nextSum;

      adjustment = square - squaredSumCorrection;
      nextSum = squaredSum + adjustment;
      squaredSumCorrection = (nextSum - squaredSum) - adjustment;
      squaredSum = nextSum;

      if (!Number.isFinite(sum) || !Number.isFinite(squaredSum)) {
        return false;
      }
    }

    this.#setPreview(
      origin,
      sum,
      sumCorrection,
      squaredSum,
      squaredSumCorrection,
      1,
      0,
      false,
      projectedSize,
      0,
    );
    return true;
  }

  #setPreview(
    origin: number,
    sum: number,
    sumCorrection: number,
    squaredSum: number,
    squaredSumCorrection: number,
    scale: number,
    scaleCount: number,
    scaled: boolean,
    size: number,
    rebaseAge: number,
  ): void {
    this.#previewOrigin = origin;
    this.#previewSum = sum;
    this.#previewSumCorrection = sumCorrection;
    this.#previewSquaredSum = squaredSum;
    this.#previewSquaredSumCorrection = squaredSumCorrection;
    this.#previewScale = scale;
    this.#previewScaleCount = scaleCount;
    this.#previewScaled = scaled;
    this.#previewSize = size;
    this.#previewRebaseAge = rebaseAge;
  }

  #meanValue(origin: number, sum: number, scale: number, scaled: boolean, size: number): number {
    const mean = origin + (sum / size);

    if (!scaled) {
      return mean;
    }

    return Math.max(-1, Math.min(1, mean)) * scale;
  }

  #standardDeviationValue(
    sum: number,
    squaredSum: number,
    scale: number,
    scaled: boolean,
    size: number,
  ): number {
    const meanDistance = sum / size;
    const variance = Math.max(0, (squaredSum / size) - (meanDistance * meanDistance));
    const deviation = Math.sqrt(variance);
    return scaled ? Math.min(1, deviation) * scale : deviation;
  }
}

function hasSubnormalSquare(distance: number, square: number): boolean {
  return distance !== 0 && square < MIN_NORMAL_NUMBER;
}

function hasCatastrophicCancellation(left: number, right: number, result: number): boolean {
  const inputMagnitude = Math.max(Math.abs(left), Math.abs(right));
  return inputMagnitude > 0 && Math.abs(result) <= inputMagnitude * CANCELLATION_THRESHOLD;
}
