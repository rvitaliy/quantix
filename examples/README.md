# Examples

Runnable examples for each public indicator in `@rvitaliy/quantix`.

They use a deterministic, fictional series of dated daily closes with realistic market-sized moves. Each streaming example first calls `moment(close)`
to preview an unfinished session, then calls `next(close)` to commit the official close. The final calculation also shows the equivalent batch API.

- [sma.ts](./sma.ts)
- [smma.ts](./smma.ts)
- [rsi.ts](./rsi.ts)
- [standard-deviation.ts](./standard-deviation.ts)
- [bollinger-bands.ts](./bollinger-bands.ts)

Run an example from the repository root:

```bash
deno run examples/rsi.ts
```
