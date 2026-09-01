import { SMA } from '../mod.ts';
import { CLOSE_VALUES, DAILY_CLOSES } from './daily-closes.ts';

const indicator = new SMA({ period: 14 });

console.log('Daily SMA(14): preview the session close, then commit it');
for (const { date, close } of DAILY_CLOSES) {
  const projectedBeforeClose = indicator.moment(close);
  const committedAtClose = indicator.next(close);

  console.log({ date, close, projectedBeforeClose, committedAtClose });
}

console.log('Latest batch SMA(14)', {
  date: DAILY_CLOSES.at(-1)!.date,
  value: SMA.from(CLOSE_VALUES, { period: 14 }).at(-1),
});
