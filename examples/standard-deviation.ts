import { StandardDeviation } from '../mod.ts';
import { CLOSE_VALUES, DAILY_CLOSES } from './daily-closes.ts';

const indicator = new StandardDeviation({ period: 20 });

console.log('Daily population standard deviation(20): preview, then commit');
for (const { date, close } of DAILY_CLOSES) {
  const projectedBeforeClose = indicator.moment(close);
  const committedAtClose = indicator.next(close);

  console.log({ date, close, projectedBeforeClose, committedAtClose });
}

console.log('Latest batch population deviation(20)', {
  date: DAILY_CLOSES.at(-1)!.date,
  value: StandardDeviation.from(CLOSE_VALUES, { period: 20 }).at(-1),
});
