import { projectWeightedAverage } from './numeric.ts';

/** Allocation-free, trusted-state implementation of Wilder smoothing. */
export class WilderAverage {
  readonly #period: number;
  #average = 0;
  #filled = 0;
  #previewAverage = 0;
  #previewFilled = 0;

  constructor(period: number) {
    this.#period = period;
  }

  next(value: number): number | undefined {
    const result = this.preview(value);
    this.commitPreview();
    return result;
  }

  preview(value: number): number | undefined {
    if (this.#filled === 0) {
      this.#previewAverage = value;
      this.#previewFilled = 1;
    } else if (this.#filled < this.#period) {
      this.#previewFilled = this.#filled + 1;
      this.#previewAverage = projectWeightedAverage(this.#average, value, this.#previewFilled);
    } else {
      this.#previewFilled = this.#filled;
      this.#previewAverage = projectWeightedAverage(this.#average, value, this.#period);
    }

    return this.#previewFilled < this.#period ? undefined : this.#previewAverage;
  }

  commitPreview(): void {
    this.#average = this.#previewAverage;
    this.#filled = this.#previewFilled;
  }
}
