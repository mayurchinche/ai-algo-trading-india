# Graph Report - ai-algo-trading-india  (2026-09-26)

## Corpus Check
- 150 files · ~64,684 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 978 nodes · 1851 edges · 81 communities (65 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e20396be`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]

## God Nodes (most connected - your core abstractions)
1. `formatIST()` - 30 edges
2. `apiUrl()` - 27 edges
3. `compilerOptions` - 19 edges
4. `Android test builds` - 19 edges
5. `advancePaper()` - 17 edges
6. `istDate()` - 17 edges
7. `compilerOptions` - 16 edges
8. `newPaperAccount()` - 16 edges
9. `useStockDiscovery()` - 16 edges
10. `runScan()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `memoryStore()` --calls--> `newPaperAccount()`  [EXTRACTED]
  tests/shared-paper.test.ts → server/paperEngine.js
- `advancePaper()` --calls--> `event`  [INFERRED]
  server/paperEngine.js → tests/paper-database.mjs
- `discover()` --calls--> `discoverStocks()`  [INFERRED]
  scripts/paper-worker.mjs → src/services/stockDiscovery.ts
- `cycle()` --calls--> `fetchQuotes()`  [INFERRED]
  scripts/paper-worker.mjs → src/services/stockDiscovery.ts
- `scan()` --calls--> `discoverStocks()`  [INFERRED]
  scripts/signal-worker.mjs → src/services/stockDiscovery.ts

## Communities (81 total, 16 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (78): AlertsPage(), SignalsPage(), StockAnalysisPage(), LegacyTradesPage(), money(), TradesPage(), listeners, publish() (+70 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (18): IPOPage(), angelOneApplyIPO(), angelOneLogin(), autoApplyForIPO(), AutoApplySettings, BrokerConfig, dhanApplyIPO(), dhanFetchIPOList() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (41): opportunityDecisions(), recordOpportunities(), action, android, bad, before, body, candidate (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.20
Nodes (18): Header(), HeaderProps, sections, LiveStock, getNotificationSettings(), NotificationSettings, notify(), notifyDailySummary() (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (10): devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (22): BacktestPage(), BacktestConfig, BacktestResult, BacktestTrade, breakoutSignal(), computeATR(), computeBollingerBands(), computeDirectionAccuracy() (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (61): OpportunityCard(), money(), OverviewPage(), PaperAmendment(), PaperEvidencePanel(), Action, ExecutionSettings, PaperExecutionPanel() (+53 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (27): newPaperAccount(), advanceWorkflow(), amendPendingEntry(), cancelEntryRemainder(), configureExecution(), DEFAULT_EXECUTION, live, record() (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (17): AlertPreferences, alertRequest(), defaultAlertPreferences, disableDevicePush(), enableDevicePush(), installationId(), MobileAlert, DEVICE_ID (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (6): Data/hosting references checked, Implemented, Not complete / deployment dependencies, Trading audit and repair — 18 September 2026, Validation, What was wrong

### Community 12 - "Community 12"
Cohesion: 0.60
Nodes (5): fetchFromInvestorGain(), fetchSubscriptions(), financialYear(), handler(), HEADERS

### Community 13 - "Community 13"
Cohesion: 0.38
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (4): Button, ButtonProps, Hero, Navigation

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (4): code:json ({), Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (13): maxDuration, maxDuration, buildCommand, crons, framework, functions, api/*.js, api/shared-paper.ts (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (5): AppDelegate, SceneDelegate, UIApplicationDelegate, UIResponder, UIWindowSceneDelegate

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (13): dependencies, @capacitor/android, @capacitor/core, @capacitor/ios, @capacitor/push-notifications, firebase-admin, framer-motion, lucide-react (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (13): devDependencies, @capacitor/cli, @electric-sql/pglite, esbuild, oxlint, tailwindcss, @tailwindcss/vite, @types/node (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (12): engines, node, name, private, type, version, engines, node (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (20): handler(), db, scan(), started, equityAlert(), notificationContent(), validateAlert(), dispatchAlerts() (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (13): scripts, build, build:server, check:deployment, dev, lint, mobile:android, mobile:ios (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.20
Nodes (9): Activate the backend, Architecture, Build the apps, Native mobile alerts — implementation and activation, Options safety gate, References checked, Release checks still required, Verification completed in this change (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (8): dependencies, framer-motion, lucide-react, react, react-dom, react-is, recharts, @supabase/supabase-js

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 30 - "Community 30"
Cohesion: 0.40
Nodes (4): images, info, author, version

### Community 31 - "Community 31"
Cohesion: 0.40
Nodes (4): images, info, author, version

### Community 34 - "Community 34"
Cohesion: 0.50
Nodes (3): info, author, version

### Community 47 - "Community 47"
Cohesion: 0.10
Nodes (19): Acceptance for this delivery, Continuation, Daily workflow implementation — v1.4.0, Delivery evidence, Errors, Goal, Order controls completion, Paper brokerage experience — phased implementation (+11 more)

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): Limitations, Release gate, Required configuration, Root cause, Vercel release and Android backend setup, Verification

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (4): json(), market(), now, requireProductionData

### Community 50 - "Community 50"
Cohesion: 0.10
Nodes (20): Android test build, Android test builds, Cumulative balance and funding verification build, Latest: v1.1.0 — no login, direct Paper trades, Latest: v1.2.0 — IPO layout and paper workspace, Latest: v1.3.0 — signal tickets and order controls, Latest: v1.4.0 — trading home, opportunity cards and timelines, Latest: v1.5.0 — shared user1 paper account (+12 more)

### Community 51 - "Community 51"
Cohesion: 0.22
Nodes (8): before, data, now, old, queue, result, saved, stock

### Community 52 - "Community 52"
Cohesion: 0.20
Nodes (9): Broker-style paper trading design, Data and operation dependencies, Next slice: tickets and intentional delay, Primary sources, Product-specific activation requirements, Recorded journey, Remaining dependencies, Strategy research and promotion (+1 more)

### Community 54 - "Community 54"
Cohesion: 0.18
Nodes (10): Current source: shared user1 account — activation pending, Current source: shared user1 account — deployed, Default: no sign-in required, Deployment required before activation, Execution semantics, Historical balance and paper funding, Optional server mode: deployment required before activation, Persistent paper trading (+2 more)

### Community 56 - "Community 56"
Cohesion: 0.10
Nodes (21): balance, blocked, candidate, e, filled, otherSignal, partialExit(), pending() (+13 more)

### Community 57 - "Community 57"
Cohesion: 0.13
Nodes (14): createSharedPaperHandler(), observeSharedPaper(), serverMarketJSON(), computeBollingerPosition(), computeEMA(), computeFOAnalysis(), computeMACD(), computeOverallSignal() (+6 more)

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (4): tradingSegments, db, existing, result

### Community 60 - "Community 60"
Cohesion: 0.17
Nodes (3): NSE_FO_SYMBOLS, OptionLeg, OptionsStrategy

### Community 61 - "Community 61"
Cohesion: 0.15
Nodes (15): SegmentPaperAccount(), useLiveStocks(), useNativeAlerts(), useTradingRuntime(), AlertsPage, App(), BacktestPage, DiscoveryPage (+7 more)

### Community 62 - "Community 62"
Cohesion: 0.13
Nodes (18): fundedCapital(), importLegacyPaper(), PaperAccountError, paperBalance(), round(), transferPaperFunds(), adjustment(), b (+10 more)

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (5): Account behavior, Activate in this order, Shared paper account user1, Status, Verification

### Community 65 - "Community 65"
Cohesion: 0.26
Nodes (10): estimatePaperEconomics(), paperExecutionFees(), round(), advancePaper(), cost(), day(), minute(), round() (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.15
Nodes (10): ALLOCATION, MetalsPage(), signalStyles, fetchChart(), fetchIndianRetailPrices(), fetchLiveMetals(), IndianRetailPrices, LiveMetal (+2 more)

### Community 67 - "Community 67"
Cohesion: 0.24
Nodes (6): SmartPicksPage(), StockCard(), generateOptionsPicks(), OptionsPick, StoredSignal, DiscoveredStock

### Community 69 - "Community 69"
Cohesion: 0.22
Nodes (10): ALLOTMENT_TIPS, fetchLiveIPOs(), fetchSubscriptionData(), financialYear(), isFreshIPOCache(), parseIPORows(), scoreIPO(), stripHtml() (+2 more)

### Community 70 - "Community 70"
Cohesion: 0.25
Nodes (7): Deployment order, Five-segment paper account foundation, Live verification, Release status — 26 September 2026, Remaining phases, Scope, Verification

### Community 71 - "Community 71"
Cohesion: 0.30
Nodes (10): fetchNifty(), fetchSingleStock(), YahooChartMeta, fetchMarketStatus(), MarketStatus, fetchHistorical(), fetchScreener(), apiUrl() (+2 more)

### Community 74 - "Community 74"
Cohesion: 0.33
Nodes (4): alerts, now, sell, storage

### Community 75 - "Community 75"
Cohesion: 0.20
Nodes (7): parseMetalChart(), config, data, now, requests, res, result

### Community 77 - "Community 77"
Cohesion: 0.29
Nodes (6): Behaviour, Limits, Live verification, Release status — 26 September 2026, Shared opportunity feed, Verification and deployment

### Community 78 - "Community 78"
Cohesion: 0.23
Nodes (14): handler(), handler(), handler(), handler(), handler(), accounts(), candidates, cycle() (+6 more)

### Community 79 - "Community 79"
Cohesion: 0.20
Nodes (6): env, validateMobileApiBase(), data, pre, req, res

### Community 80 - "Community 80"
Cohesion: 0.33
Nodes (5): Corrected score inflation, Cost-adjusted paper references, Measured impact, Signal calibration and cost diagnostics, Validation

## Knowledge Gaps
- **413 isolated node(s):** `tsBuildInfoFile`, `target`, `lib`, `types`, `skipLibCheck` (+408 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiUrl()` connect `Community 71` to `Community 1`, `Community 66`, `Community 3`, `Community 5`, `Community 69`, `Community 57`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `discoverStocks()` connect `Community 57` to `Community 0`, `Community 2`, `Community 71`, `Community 75`, `Community 78`, `Community 25`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `newPaperAccount()` connect `Community 8` to `Community 65`, `Community 2`, `Community 78`, `Community 56`, `Community 58`, `Community 62`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `tsBuildInfoFile`, `target`, `lib` to the rest of the system?**
  _413 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.061009817671809255 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04440333024976873 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.05934242181234964 - nodes in this community are weakly interconnected._