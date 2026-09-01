/**
 * Fictional, but market-shaped, daily closes for a liquid US equity.
 * Dates make ordering and gaps explicit without tying tests to a live data feed.
 */
export const DAILY_CLOSES = [
  { date: '2025-04-01', close: 187.42 },
  { date: '2025-04-02', close: 188.11 },
  { date: '2025-04-03', close: 187.36 },
  { date: '2025-04-04', close: 189.02 },
  { date: '2025-04-07', close: 188.47 },
  { date: '2025-04-08', close: 190.15 },
  { date: '2025-04-09', close: 189.74 },
  { date: '2025-04-10', close: 191.08 },
  { date: '2025-04-11', close: 190.22 },
  { date: '2025-04-14', close: 189.63 },
  { date: '2025-04-15', close: 191.31 },
  { date: '2025-04-16', close: 192.04 },
  { date: '2025-04-17', close: 191.46 },
  { date: '2025-04-21', close: 192.58 },
  { date: '2025-04-22', close: 194.21 },
  { date: '2025-04-23', close: 193.37 },
  { date: '2025-04-24', close: 192.84 },
  { date: '2025-04-25', close: 194.56 },
  { date: '2025-04-28', close: 195.18 },
  { date: '2025-04-29', close: 194.43 },
  { date: '2025-04-30', close: 196.07 },
  { date: '2025-05-01', close: 195.29 },
  { date: '2025-05-02', close: 196.84 },
  { date: '2025-05-05', close: 197.41 },
  { date: '2025-05-06', close: 196.52 },
  { date: '2025-05-07', close: 195.88 },
  { date: '2025-05-08', close: 197.56 },
  { date: '2025-05-09', close: 198.03 },
  { date: '2025-05-12', close: 197.21 },
  { date: '2025-05-13', close: 198.74 },
  { date: '2025-05-14', close: 199.12 },
  { date: '2025-05-15', close: 198.36 },
  { date: '2025-05-16', close: 200.04 },
  { date: '2025-05-19', close: 199.47 },
  { date: '2025-05-20', close: 201.18 },
  { date: '2025-05-21', close: 200.32 },
  { date: '2025-05-22', close: 201.06 },
  { date: '2025-05-23', close: 202.15 },
  { date: '2025-05-27', close: 201.47 },
] as const;

export const CLOSES: readonly number[] = DAILY_CLOSES.map(({ close }) => close);

export function* closeGenerator(values: readonly number[] = CLOSES): Generator<number> {
  for (const value of values) {
    yield value;
  }
}
