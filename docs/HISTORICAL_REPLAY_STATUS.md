# Historical replay implementation status

26 September 2026. Local implementation; no production deployment or trading-account changes.

Implemented:
- Pure `evaluateDiscoverySnapshot` shared between live discovery and historical research. Existing indicator formulae, weights, guards and risk levels preserved; caller supplies time.
- Private as-of bar store: completed/published bars only; full session prefix required; prior daily warm-up and year-history checks; explicit stale/missing-data outcomes.
- Kite read-only historical adapter with strict candles, timezone, range and ordering validation. No broker-order capability. Credential/provider errors are summarized without response contents.
- Preflight command reports equity/index/futures/expired-option readiness. A sample response is not a full coverage certificate.
- Draft three-week protocol with five sections, budgets, entry delays and honest unresolved gates.
- Synthetic calculation goldens from the pre-extraction source plus future-data mutation/removal tests. Fixtures are not market-performance evidence.

Run preflight:

```
node --env-file=.env.kite scripts/research/data-preflight.mjs /tmp/kite-preflight.json /path/to/verified-instruments.json
```

Copy `.env.kite.example` to the ignored `.env.kite` and configure credentials locally. Never put them in VITE variables, reports, Git or chat.

Instrument manifest format: `{ "samples": [{ "kind": "equity-a", "symbol": "<exchange symbol>", "instrumentToken": "<verified numeric token>", "referenceSource": "<instrument-master provenance>", "referenceAsOf": "<ISO timestamp>" }] }`. Required sample kinds: equity-a, equity-b, index, futures, expired-option. Do not invent expired tokens or use today's reused token without historical identity verification. The manifest is caller-verified; the preflight does not independently authenticate that mapping. Credentials are read only from environment, never manifest fields.

Actual local preflight: all five sample types CREDENTIALS_MISSING. No authenticated market data was requested, and no historical win rate was generated. Requested the credential configuration location from the user without requesting secret values.

Remaining:
- Verified session calendar, historical universe, corporate actions, date-effective costs and full source manifest before protocol freeze.
- Historical downloader and persistence. Current as-of inputs must already be normalized; no bulk download or report UI exists yet.
- Candle execution adapter with delayed fills and equity curve; the as-of layer scores candles but is not an execution simulator.
- Other four segment policies/adapters, actual historical derivative prices/margin and broader validation.

Research minute-close inputs use a labelled model and cumulative candle volume; they are not original Yahoo screener snapshots. The protocol remains DRAFT_BLOCKED_CALENDAR_AND_DATA and must not produce a production-readiness claim.
