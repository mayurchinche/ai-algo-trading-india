# Paper brokerage experience — phased implementation

## Goal
Make the Android IPO page readable and deliver an auditable, broker-style paper workspace without claiming exchange-exact fills or proven top-percentile returns.

## Phase 1 — Mobile layout and product design (complete)
Fix IPO name/source/score overlap at narrow widths and larger text. Document product semantics and external dependencies.

## Phase 2 — Intraday execution workspace (complete)
Separate Orders, Positions and Closed trades; show remaining quantity, average entry, latest observed price/time, gross and estimated net P&L, source/processing timestamps and full audit trail. Preserve all existing balances and history. Explicit asset-class views with unavailable execution blocked. Verify delayed signal/order/fill chronology and same-timestamp exit rejection.

## Phase 3 — Broker order controls and short-term holdings (partially complete)
Signal-linked order ticket, manual review or configurable automatic reaction delay, market/limit/stop orders with cancellation and rejection reasons. Delivery-only long holdings; separate overnight policy, trading calendar, corporate actions, settlement, delivery charges and holdings ledger. Enable only after data and integration tests cover these distinctions.

## Phase 4 — Futures and options (external data dependency)
Verified exchange instrument master, expiry/strike/option type/lot size/tick size, contract quotes and depth, margin and daily MTM, expiry settlement and option risk analytics. No underlying-equity quote substituted for a derivative fill. Provider choice and API access are required before activating these views.

## Phase 5 — Strategy validation and continuous operation (evidence foundation complete; validation/hosting pending)
Versioned strategy registry, strategy rationale at signal time, chronological out-of-sample and walk-forward validation, realistic charges/slippage, drawdown/exposure limits, benchmark comparison and forward paper evaluation. No top-1% claim without evidence. Device-only monitoring remains foreground-only; always-on execution needs durable backend identity and a hosted worker.

## Acceptance for this delivery
Phase 1 and 2 complete, tests/build pass, Android APK includes fixes, release guide identifies current build. Later phases explicitly remain planned/dependency-gated rather than represented as working trading.

## Errors
- Original checkout has incompatible/missing oxlint native bindings. Validation moved to the existing ARM-compatible build workspace, with changed source files copied exactly.

## Delivery evidence
77 tests plus database checks passed. Lint/web/mobile build and Gradle assembleDebug passed. Live IPO cards verified at 320/360px. v1.2.0 APK packaged with new workspace and IPO CSS. Not deployed and not tested on a physical phone.

## Continuation
Implement persisted signal intents, manual tickets, automatic reaction delay, limit/stop entry conditions, cancellation of unfilled remainders and recorded strategy evidence. Short-term delivery remains gated on settlement/corporate-action data; futures/options on provider selection and verified contract quotes.

### v1.3.0 implementation status
Tickets, delays, market/limit/stop-entry orders, remainder cancellation and descriptive strategy evidence implemented. Pending-entry amendments and DAY/IOC validity are now implemented and tested. Delivery holdings, derivative execution, walk-forward validation and hosted operation remain incomplete. Market-provider question is pending; no provider activation or deployment is implied.

### Order controls completion
Unfilled/untriggered limit and stop entries support price amendments and quantity reductions within original risk/capital limits. Amendment timestamps prevent pre-amendment fills. Validity choices: TTL2, intraday DAY until 15:15 IST, or IOC first eligible quote; stop-IOC is rejected. 90 regression tests passed.

### Daily workflow implementation — v1.4.0
Build a real-data trading home, opportunity cards, and shared trade-detail timeline. Link cards to existing signal controls. Preserve recorded source/processing times, surface stale/missing data, calculate today's closed results by IST exit date, and keep options/futures visibly unavailable. No strategy-selection changes or invented sample data in production. Verify regression tests, mobile build, narrow layouts and Android packaging.

Completed daily workflow: Home/cards/shared timeline implemented. Signal events now join their order timeline, with pagination and snapshot sequence coverage. 93 tests plus database checks, lint, mobile/Android builds passed. Desktop and 320/360px inspection completed using real observations plus isolated synthetic timeline fixture. v1.4.0 APK versionCode 5 packaged and staged; physical install, deployment and open-session verification remain unperformed.

### Shared user1 account (25 September 2026)
Replace current device execution/UI adapter with one dedicated shared backend account, no sign-in form. Backend computes observations; database lease, revision checks and idempotent requests prevent duplicate cross-device activity. Preserve previous device records for export/reconciliation. Code, database migration and Android v1.5.0 are committed and pushed. Vercel is activated after correcting the server credential; identical web/Android-origin reads and Android CORS passed. Historical reconciliation, physical installation and open-session validation remain incomplete. See docs/SHARED-USER1-PAPER.md.
