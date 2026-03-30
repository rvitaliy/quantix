import { SMMA } from '../indicators/smma.ts';

export type AverageChange = {
  readonly averageGain: number;
  readonly averageLoss: number;
};

export class AvgChangeProvider {
  readonly #averageGain: SMMA;
  readonly #averageLoss: SMMA;
  #previousValue: number | undefined;

  constructor(period: number) {
    this.#averageGain = new SMMA({ period });
    this.#averageLoss = new SMMA({ period });
  }

  next(value: number): AverageChange | undefined {
    if (this.#previousValue === undefined) {
      this.#previousValue = value;
      return undefined;
    }

    const result = this.#project(value, false);
    this.#previousValue = value;
    return result;
  }

  moment(value: number): AverageChange | undefined {
    if (this.#previousValue === undefined) {
      return undefined;
    }

    return this.#project(value, true);
  }

  #project(value: number, preview: boolean): AverageChange | undefined {
    const change = value - this.#previousValue!;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    const averageGain = preview ? this.#averageGain.moment(gain) : this.#averageGain.next(gain);
    const averageLoss = preview ? this.#averageLoss.moment(loss) : this.#averageLoss.next(loss);

    if (averageGain === undefined || averageLoss === undefined) {
      return undefined;
    }

    return { averageGain, averageLoss };
  }
}
