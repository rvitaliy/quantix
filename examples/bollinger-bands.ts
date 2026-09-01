import { BollingerBands } from '../mod.ts';
import { CLOSE_VALUES, DAILY_CLOSES } from './daily-closes.ts';

const indicator = new BollingerBands({ period: 20, standardDeviations: 2 });

console.log('Daily Bollinger Bands(20, 2): preview the session close, then commit it');
for (const { date, close } of DAILY_CLOSES) {
  const projectedBeforeClose = indicator.moment(close);
  const committedAtClose = indicator.next(close);

  console.log({ date, close, projectedBeforeClose, committedAtClose });
}

console.log('Latest batch Bollinger Bands(20, 2)', {
  date: DAILY_CLOSES.at(-1)!.date,
  value: BollingerBands.from(CLOSE_VALUES, { period: 20, standardDeviations: 2 }).at(-1),
});
