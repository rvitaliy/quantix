# @rvitaliy/quantix

Streaming-first technical indicators in modern TypeScript.

The repository currently contains:

- public indicators: `SMA`, `SMMA`, `RSI`, `StandardDeviation`, `BollingerBands`
- focused source code in [`src/`](./src)
- runnable usage examples in [`examples/`](./examples)
- unit and golden tests for the published package

Repository: `https://github.com/rvitaliy/quantix`

## Install

```bash
deno add jsr:@rvitaliy/quantix
```

For npm consumers through JSR:

```bash
npx jsr add @rvitaliy/quantix
```

## Examples

Usage examples for every public indicator are available in [examples/README.md](./examples/README.md).

## Contributing

Development uses modern TypeScript tooling.

The standard local verification workflow is:

```bash
cd quantix
deno task check
```

## Repository Contents

- [`src/`](./src): indicator implementations and small internal primitives
- [`tests/`](./tests): unit and golden tests
- [`examples/`](./examples): runnable examples for the public API
