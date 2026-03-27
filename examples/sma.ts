import { SMA, sma } from '../mod.ts';

const prices = Array.from({ length: 20 }, (_, index) => 100 + index);
const indicator = new SMA();

console.log('Streaming SMA');
for (const price of prices) {
  console.log({
    price,
    next: indicator.next(price),
    momentWithPlusOne: indicator.moment(price + 1),
  });
}

console.log('\nBatch SMA');
console.log(sma(prices));
