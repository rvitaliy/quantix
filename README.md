# @rvitaliy/quantix

Streaming-first technical indicators for Deno and modern TypeScript. Quantix keeps a small API, validates numeric input, and lets applications preview
an observation without mutating the committed indicator state.

Available indicators:

- `SMA`: simple moving average
- `SMMA`: Wilder-style smoothed moving average
- `RSI`: Relative Strength Index
- `StandardDeviation`: rolling population standard deviation
- `BollingerBands`: SMA-based lower, middle, and upper bands

## Install

With Deno:

```bash
deno add jsr:@rvitaliy/quantix@^2.0.0
```

For an npm-based project through JSR:

```bash
npx jsr add @rvitaliy/quantix@^2.0.0
```

## Quick start

```ts
import { RSI, StandardDeviation } from 'jsr:@rvitaliy/quantix@^2.0.0';

// Plausible daily closing prices for one instrument, oldest first.
const closes = [
  184.37,
  185.12,
  183.94,
  186.21,
  187.05,
  186.48,
  188.16,
  189.02,
  188.44,
  190.31,
  191.08,
  190.42,
  192.17,
  191.63,
  193.24,
  194.11,
  193.56,
  195.08,
  194.72,
  196.35,
];

const rsi = new RSI({ period: 14 });
const volatility = new StandardDeviation({ period: 20 });

for (const close of closes) {
  console.log({
    close,
    rsi: rsi.next(close),
    standardDeviation: volatility.next(close),
  });
}

// Preview an indicative close without committing it.
const indicativeClose = 197.1;
console.log({
  projectedRsi: rsi.moment(indicativeClose),
  projectedStandardDeviation: volatility.moment(indicativeClose),
});

// Commit the close only when it becomes final.
rsi.next(indicativeClose);
volatility.next(indicativeClose);
```

## State model

Every indicator has the same streaming contract:

- `next(value)` validates and commits one observation.
- `moment(value)` returns the result that the observation would produce, without changing committed state. Repeated calls are safe. A moment can also
  produce the first result when its virtual observation completes the warm-up window.
- `Indicator.from(values, options)` processes any iterable into a result series. Warm-up positions are retained as `undefined`.

Input observations must be finite numbers. A `period` must be a positive safe integer. Bollinger Bands also require a finite, non-negative
`standardDeviations` multiplier. Invalid input throws before committed state changes. Bollinger Bands also throw without committing when a requested
band lies outside JavaScript's finite numeric range.

RSI needs one initial close plus `period` price changes. Once ready, its value is in the `0..100` range: an unchanged seed is neutral at `50`, a
window without losses is `100`, and a window without gains is `0`.

## API overview

| Indicator           |                Default | Result                                |
| ------------------- | ---------------------: | ------------------------------------- |
| `SMA`               |            period `14` | rolling arithmetic mean               |
| `SMMA`              |            period `14` | Wilder-smoothed mean                  |
| `RSI`               |            period `14` | oscillator in the `0..100` range      |
| `StandardDeviation` |            period `20` | rolling population standard deviation |
| `BollingerBands`    | period `20`, width `2` | `{ lower, middle, upper }`            |

Runnable examples for every public indicator are in [examples](./examples/README.md).

## Migrating from 1.x

Version 2 makes `StandardDeviation` responsible for its own rolling mean. Remove the second argument previously passed to `next` and `moment`:

```ts
const deviation = new StandardDeviation({ period: 20 });

deviation.next(close); // 2.x
deviation.moment(indicativeClose); // 2.x
```

This keeps the public contract consistent with the other indicators and avoids maintaining a separate `SMA` solely for deviation calculations. Version
2 also defines warm-up projection and neutral RSI behavior explicitly, so applications that depended on the older edge cases should update their
expectations.

## Development

The repository uses Deno `2.9.6`. Dependencies are recorded in `deno.lock`, and normal commands run with a frozen lockfile.

```bash
deno task check
deno task coverage
```

When intentionally changing a dependency, update `deno.jsonc` and refresh the lockfile explicitly:

```bash
deno install --frozen=false
deno task check
```

Source lives in [src](./src), focused tests in [tests](./tests), and runnable programs in [examples](./examples). See the
[security policy](./.github/SECURITY.md) before reporting a vulnerability.

## Maintainer release setup

The release workflow publishes through GitHub OIDC, so no long-lived JSR token is required. Before publishing:

1. Link `@rvitaliy/quantix` to this GitHub repository in the JSR package settings and require CI publishing.
2. Create a GitHub environment named `jsr`. Limit it to protected tags matching `v*` and add required reviewers.
3. Protect `main` with a ruleset that requires pull requests and the `Checks / Quality` status check, and blocks force pushes and deletion.
4. Protect tags matching `v*` so only maintainers can create or update release tags.
5. In the Actions settings, keep the default workflow token read-only and require actions to be pinned to full commit SHAs.
6. Enable private vulnerability reporting for the repository.

To release, update the package version, merge the change into `main`, then create the matching tag such as `v2.0.0` on that commit. The workflow
verifies the exact tag/version match, proves that the tagged commit is an ancestor of `main`, reruns all checks, and publishes through the protected
`jsr` environment.
