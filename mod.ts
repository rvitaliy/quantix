/**
 * Streaming-first technical indicators for modern TypeScript.
 *
 * Each indicator exposes `next(value)` to commit an observation, `moment(value)`
 * to preview one without changing committed state, and a static `from(values)`
 * helper for batch processing.
 *
 * @module
 */

export { BollingerBands, type BollingerBandsOptions, type BollingerBandsResult } from './src/indicators/bollinger-bands.ts';
export { RSI, type RSIOptions } from './src/indicators/rsi.ts';
export { SMA, type SMAOptions } from './src/indicators/sma.ts';
export { SMMA, type SMMAOptions } from './src/indicators/smma.ts';
export { StandardDeviation, type StandardDeviationOptions } from './src/indicators/standard-deviation.ts';
