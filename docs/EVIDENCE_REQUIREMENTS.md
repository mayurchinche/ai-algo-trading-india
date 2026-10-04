# Evidence-led analysis: requirements and implementation status

Agreed scope: intraday, short term, long term, options and futures. No claim of analyst-level completeness or profitable/top-percentile performance until evidence and execution requirements pass validation.

## Phase 1 — implemented foundation

- `decision-evidence-v1` produces a separate shadow research assessment for every newly recorded candidate in both shared worker paths. Existing technical execution remains the explicitly identified baseline.
- Facts carry instrument identity, category, key, value, unit, source URL/name, verification status, publication time, actual system receipt time and expiry. Statement period-end alone never establishes availability. Verification flags must come from reviewed server-side source adapters; the evaluator itself does not audit a filing's authenticity.
- Selection requires BOTH publication and receipt on/before the decision, rejects stale/malformed/future/unverified records, and selects the latest eligible publication revision. Ambiguous revision identifiers fail rather than silently replacing facts. A source snapshot downloaded today cannot be retrospectively treated as observed months ago.
- Six thesis sections require citations to accepted fact IDs: why this stock, why now, contrary evidence, entry condition, invalidation and exit plan. Risk requires quantity, capital at risk, planned stop loss, estimated costs, cost model, risk budget, supported assumptions and an explicitly bounded or unbounded worst case. A stop is not a guaranteed maximum loss.
- Missing requirements produce NO_TRADE for this shadow policy. Complete evidence produces REVIEW_REQUIRED, never automatic permission to buy. Technical baseline trades do not acquire analyst approval merely by carrying this report.
- Reports are hashed and saved with first-observation signal events. Repeated scans retain the original report. Older signals are labelled unassessed; newer facts do not backfill old decisions. Existing event exports include the evidence snapshot.
- Comparison utility consumes supplied observed baseline/challenger ledger marks under a frozen protocol, identical observation schedule, data snapshot and cost model. It calculates flow-adjusted net return, net P&L, observed drawdown and time-weighted gross exposure. Missing marks, monitoring gaps or mismatched policies return UNAVAILABLE, not zero. No synthetic replay trades are created.

## Mode-specific required evidence categories

| Mode | Required categories |
|---|---|
| Intraday | Sector, news/event review, liquidity, session |
| Short term | Financials, sector, news/event review, liquidity, corporate actions |
| Long term | Financials, sector, valuation, governance, news/event review, liquidity, corporate actions |
| Options | Sector/underlying regime, news/event review, liquidity, session, contract, volatility, Greeks, expiry |
| Futures | Sector/underlying regime, news/event review, liquidity, session, contract, margin, settlement |

Categories are minimum coverage checks, not proof that an assessment is financially sound. An index derivative uses constituent/index context rather than inventing company ratios for an index. A documented event review finding no material event is different from an unavailable news feed. No source is allowed to manufacture a positive/negative conclusion to fill a required category.

## Phase 2 — verified provider data (NOT implemented)

Acceptance:
- Financial statement ingestion with source documents, filing/publication/receipt times, period, consolidated/standalone basis, currency/unit and restatement version. Derived ratios retain numerator/denominator source IDs and formula version. Missing or zero denominators remain unavailable.
- Profitability, cash-flow conversion, solvency, leverage, growth and valuation ratios are compared against the company's own history and appropriate dated peer sets. No universal P/E or leverage cutoffs.
- Sector membership is dated; sector-specific metrics and regimes are documented, versioned and tested. Examples to research include banking asset quality and capital adequacy versus industrial working-capital and debt metrics; these are not interchangeable.
- Exchange/company announcements corroborate material news. Rumours, recommendations and headlines alone cannot authorize entries or establish investor identity.
- Source quality, staleness limits and legal/API availability reviewed. Current Upstox adapter only implements selected price/history/status reads, not a verified financial/sector/news ingestion pipeline.

## Phase 3 — mode-specific thesis and execution integration (NOT implemented)

Acceptance:
- Server builds substantive thesis sections from accepted facts, including contrary evidence, scenarios, event risk and explicit no-trade rationale. LLM prose cannot invent numeric values or facts.
- Deterministic execution checks validate session, freshness, spread, quantity, instrument metadata, risk/capital, corporate actions, settlement and mode-specific contract/margin/expiry constraints. Existing pilot approximations remain labelled.
- Before shadow assessment controls orders, prospective results and failure cases must be reviewed. Baseline and challenger must have separate portfolios and capital accounting so one cannot affect the other's capacity.
- All modes expose the same immutable evidence schema in signals, trade detail, alerts and export. Current phase adds the signal assessment panel; complete alert/order workflows are pending.

## Phase 4 — historical and forward studies (utility only; study NOT run)

Acceptance:
- Freeze mode universe, membership dates, hypothesis, parameters, execution delay, costs, data snapshot, observation schedule, missing-data policy and evaluation window before running the comparison. Forward protocol must precede the first observation.
- Replay admits facts and completed bars only when available. Corporate-action adjustments, delistings, survivorship and revised financials require explicit treatment. Evaluate all candidates, including rejected/no-trade cases.
- Separate development and held-out windows; use walk-forward evaluation. No tuning on held-out outcomes. Three weeks can be diagnostic for intraday but cannot establish long-term strategy quality.
- Report net return, observed and intratrade drawdown where available, gross exposure, capital usage, turnover, costs, holding duration, sample sizes, uncertainty and exclusions. Rank neither empty accounts nor incomplete exits as successful.
- Compare identical timestamped observations and cost assumptions. End-of-interval cash-flow convention is explicit in the current comparison utility. Raw rupee profit across different starting balances is not a fair ranking.

## Current limits

No real fundamental dataset, completed analyst theses, upgraded live strategy, historical study results or new profitability evidence have been created by phase 1. Pilot execution activation and broker-equivalent execution limitations remain as documented in MULTI_MODE_PAPER.md. A source connection or successful deployment does not demonstrate an executed trade.
