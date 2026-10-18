# AlgoTrader India

A paper-trading workspace for NSE stocks and derivatives. It never sends an order to a broker. It has four parts:

- **Stock analysis**: technicals, fundamentals, NIFTY 50 peer ranks, SWOT, news, NSE announcements, bulk and block deals, delivery, FII/DII flows, futures and the option chain, with a view for each segment (intraday, swing, short term, long term, futures, options).
- **Signals**: entries from published, fixed-parameter rules. A rule produces signals only after it is profitable after broker charges on 10 years of history, across the universe and on the stock itself.
- **Paper trading**: every run is executed like live trading. Fills walk the order book, margin is checked, charges follow the broker tariff, and stops are monitored on 1-minute candles. Every order and trade is kept in a permanent ledger.
- **IPO analysis**.

See [docs/APP_REVAMP.md](docs/APP_REVAMP.md) for the design, measured strategy results and operations.

## Development

```sh
npm ci
npm test        # unit, API and PostgreSQL (PGlite) tests
npm run build
./node_modules/.bin/oxlint server api tests shared src research scripts
```

Server data sources:
- Upstox read-only API: needs `UPSTOX_ANALYTICS_TOKEN`.
- NSE public files.
- Google News RSS.
- Supabase: needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Scheduled jobs are pg_cron dispatches. They need `PAPER_SCHEDULER_SECRET`.
