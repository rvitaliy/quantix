import { RSI, rsi } from '../mod.ts';

const prices = [100, 102, 101, 104, 103, 106, 108, 107, 109, 111, 110, 113, 115, 114, 116, 118, 117, 119];
const indicator = new RSI();

console.log('Streaming RSI');
for (const price of prices) {
  console.log({
    price,
    next: indicator.next(price),
    momentWithPlusOne: indicator.moment(price + 1),
  });
}

console.log('\nBatch RSI');
console.log(rsi(prices));
