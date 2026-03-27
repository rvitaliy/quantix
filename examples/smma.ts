import { SMMA, smma } from '../mod.ts';

const prices = Array.from({ length: 20 }, (_, index) => 100 + index);
const indicator = new SMMA();

console.log('Streaming SMMA');
for (const price of prices) {
  console.log({
    price,
    next: indicator.next(price),
    momentWithPlusOne: indicator.moment(price + 1),
  });
}

console.log('\nBatch SMMA');
console.log(smma(prices));
