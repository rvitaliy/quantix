import { BollingerBands, bollingerBands } from '../mod.ts';

const prices = Array.from({ length: 24 }, (_, index) => 100 + index);
const indicator = new BollingerBands();

console.log('Streaming BollingerBands');
for (const price of prices) {
  console.log({
    price,
    next: indicator.next(price),
    momentWithPlusOne: indicator.moment(price + 1),
  });
}

console.log('\nBatch BollingerBands');
console.log(bollingerBands(prices));
