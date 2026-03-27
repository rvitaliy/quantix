import { SMA, StandardDeviation } from '../mod.ts';

const prices = Array.from({ length: 24 }, (_, index) => 100 + index);
const movingAverage = new SMA({ period: 20 });
const indicator = new StandardDeviation();

console.log('Streaming StandardDeviation');
for (const price of prices) {
  const mean = movingAverage.next(price);
  const previewMean = movingAverage.moment(price + 1);

  console.log({
    price,
    mean,
    next: indicator.next(price, mean),
    momentWithPlusOne: indicator.moment(price + 1, previewMean),
  });
}
