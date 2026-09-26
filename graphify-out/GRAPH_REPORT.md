# Graph Report - ai-algo-trading-india  (2026-09-26)

## Corpus Check
- 176 files · ~70,565 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1197 nodes · 2163 edges · 93 communities (76 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a8389d49`
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
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 93|Community 93]]

## God Nodes (most connected - your core abstractions)
1. `formatIST()` - 30 edges
2. `apiUrl()` - 27 edges
3. `istDate()` - 21 edges
4. `Android test builds` - 20 edges
5. `compilerOptions` - 19 edges
6. `newPaperAccount()` - 19 edges
7. `evaluateDiscoverySnapshot()` - 18 edges
8. `advancePaper()` - 17 edges
9. `DiscoveredStock` - 17 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `memoryStore()` --calls--> `newPaperAccount()`  [EXTRACTED]
  tests/shared-paper.test.ts → server/paperEngine.js
- `advancePaper()` --calls--> `event`  [INFERRED]
  server/paperEngine.js → tests/paper-database.mjs
- `adjustment()` --calls--> `transferPaperFunds()`  [EXTRACTED]
  tests/paper-funds.test.ts → server/paperFunds.js
- `discover()` --calls--> `discoverStocks()`  [INFERRED]
  scripts/paper-worker.mjs → src/services/stockDiscovery.ts
- `cycle()` --calls--> `fetchQuotes()`  [INFERRED]
  scripts/paper-worker.mjs → src/services/stockDiscovery.ts

## Communities (93 total, 17 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (72): AlertsPage(), listeners, publish(), runScan(), scan(), state, CandidateDecision, DecisionRecord (+64 more)

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
Cohesion: 0.17
Nodes (16): PaperAmendment(), PaperEvidencePanel(), ExecutionSettings, PaperExecutionPanel(), PaperIntent, PaperBalance, Account, money() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (20): amendPendingEntry(), cancelEntryRemainder(), configureExecution(), DEFAULT_EXECUTION, live, record(), reviewIntent(), applySharedAction() (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (22): b, calendar, counts, [dataDir,calendarPath,outputDir], diagnostics, executionBars, invalid, manifest (+14 more)

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
Cohesion: 0.07
Nodes (41): env, handler(), handler(), handler(), handler(), handler(), handler(), accounts() (+33 more)

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
Cohesion: 0.09
Nodes (21): Android test build, Android test builds, Cumulative balance and funding verification build, Latest: v1.1.0 — no login, direct Paper trades, Latest: v1.2.0 — IPO layout and paper workspace, Latest: v1.3.0 — signal tickets and order controls, Latest: v1.4.0 — trading home, opportunity cards and timelines, Latest: v1.5.0 — shared user1 paper account (+13 more)

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
Cohesion: 0.11
Nodes (22): newPaperAccount(), balance, blocked, candidate, e, filled, otherSignal, partialExit() (+14 more)

### Community 57 - "Community 57"
Cohesion: 0.11
Nodes (9): SmartPicksPage(), StockCard(), generateOptionsPicks(), NSE_FO_SYMBOLS, OptionLeg, OptionsPick, OptionsStrategy, StoredSignal (+1 more)

### Community 58 - "Community 58"
Cohesion: 0.22
Nodes (6): [origin,output], reports, tradingSegments, db, existing, result

### Community 60 - "Community 60"
Cohesion: 0.05
Nodes (53): cases, note, now, sourceSha256, createAsOfMarket(), ResearchBar, validateBars(), kinds (+45 more)

### Community 61 - "Community 61"
Cohesion: 0.11
Nodes (26): SegmentPaperAccount(), SignalsPage(), StockAnalysisPage(), LegacyTradesPage(), money(), TradesPage(), useLiveStocks(), useNativeAlerts() (+18 more)

### Community 62 - "Community 62"
Cohesion: 0.13
Nodes (12): adjustment(), b, legacy, next, now, open, original, r (+4 more)

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (5): Account behavior, Activate in this order, Shared paper account user1, Status, Verification

### Community 65 - "Community 65"
Cohesion: 0.26
Nodes (10): estimatePaperEconomics(), paperExecutionFees(), round(), advancePaper(), cost(), day(), minute(), round() (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.31
Nodes (10): fundedCapital(), importLegacyPaper(), paperBalance(), round(), transferPaperFunds(), DeviceLedger, devicePaperSymbols(), deviceSymbols() (+2 more)

### Community 67 - "Community 67"
Cohesion: 0.16
Nodes (14): [input,output], recording, sourceFiles, sourceHashes, evaluatePaperPerformance(), metrics(), round(), replayPaper() (+6 more)

### Community 69 - "Community 69"
Cohesion: 0.07
Nodes (25): b, calendar, counts, [dataDir,calendarPath,outputDir], decision, diagnostics, executionBars, invalid (+17 more)

### Community 70 - "Community 70"
Cohesion: 0.25
Nodes (7): Deployment order, Five-segment paper account foundation, Live verification, Release status — 26 September 2026, Remaining phases, Scope, Verification

### Community 71 - "Community 71"
Cohesion: 0.16
Nodes (14): fetchNifty(), fetchSingleStock(), YahooChartMeta, fetchChart(), fetchIndianRetailPrices(), fetchLiveMetals(), IndianRetailPrices, MetalConfig (+6 more)

### Community 72 - "Community 72"
Cohesion: 0.25
Nodes (7): code:block1 (node scripts/research/paper-performance.mjs https://ai-algo-), code:block2 (node scripts/research/replay-paper.mjs /path/to/observations), Current evidence, Data needed before a strategy claim, Execution replay, Measuring paper performance, Reproducible forward report

### Community 73 - "Community 73"
Cohesion: 0.09
Nodes (22): ambiguousStopTarget, barFillConvention, baselinePolicy, calendarSource, costModel, delaysSeconds, endOfWindow, from (+14 more)

### Community 74 - "Community 74"
Cohesion: 0.21
Nodes (14): OpportunityCard(), money(), OverviewPage(), TradeDetailTimeline(), TradeEvent, TradeTimelineView(), usePaperSnapshot(), orderValuation() (+6 more)

### Community 75 - "Community 75"
Cohesion: 0.16
Nodes (14): fetchSharedOpportunities(), OpportunityFeed, DecisionGroup, describeOpportunity(), OpportunityDecision, sharedPaperRequest(), boundary, closed (+6 more)

### Community 77 - "Community 77"
Cohesion: 0.29
Nodes (6): Behaviour, Limits, Live verification, Release status — 26 September 2026, Shared opportunity feed, Verification and deployment

### Community 79 - "Community 79"
Cohesion: 0.13
Nodes (14): createSharedPaperHandler(), observeSharedPaper(), serverMarketJSON(), computeBollingerPosition(), computeEMA(), computeFOAnalysis(), computeMACD(), computeOverallSignal() (+6 more)

### Community 80 - "Community 80"
Cohesion: 0.33
Nodes (5): Corrected score inflation, Cost-adjusted paper references, Measured impact, Signal calibration and cost diagnostics, Validation

### Community 81 - "Community 81"
Cohesion: 0.18
Nodes (10): JournalErrorBoundary, FundingState, money(), PaperFundsPanel(), Snapshot, downloadJSON(), apiBase, exportEarlierDeviceAccount() (+2 more)

### Community 82 - "Community 82"
Cohesion: 0.22
Nodes (10): ALLOTMENT_TIPS, fetchLiveIPOs(), fetchSubscriptionData(), financialYear(), isFreshIPOCache(), parseIPORows(), scoreIPO(), stripHtml() (+2 more)

### Community 84 - "Community 84"
Cohesion: 0.20
Nodes (7): parseMetalChart(), config, data, now, requests, res, result

### Community 85 - "Community 85"
Cohesion: 0.25
Nodes (7): round(), simulateFiveMinute(), b, open, r, run(), signal

### Community 86 - "Community 86"
Cohesion: 0.14
Nodes (11): DiscoveryPage(), StockCard(), Action, SignalTicket(), SharedOpportunityFeed(), seen, SignalPopup(), SharedOpportunity (+3 more)

### Community 87 - "Community 87"
Cohesion: 0.20
Nodes (17): AlertPreferences, alertRequest(), defaultAlertPreferences, disableDevicePush(), enableDevicePush(), installationId(), MobileAlert, DEVICE_ID (+9 more)

### Community 88 - "Community 88"
Cohesion: 0.29
Nodes (6): Brokerage and exit-data audit — 2026-09-26, Cost-only comparison (same trades, same quantities), Exit-data recovery, Readiness gate, Result, Verified published tariff

### Community 89 - "Community 89"
Cohesion: 0.21
Nodes (12): round(), sizeWithTariff(), zerodhaIntradayCosts(), args, bars, base, c, open (+4 more)

### Community 90 - "Community 90"
Cohesion: 0.40
Nodes (4): ALLOCATION, MetalsPage(), signalStyles, LiveMetal

### Community 91 - "Community 91"
Cohesion: 0.20
Nodes (8): bars, manifest, prior, [priorPath,dataset,output], repriced, runs, sourceHashes, tariffSources

## Knowledge Gaps
- **553 isolated node(s):** `tsBuildInfoFile`, `target`, `lib`, `types`, `skipLibCheck` (+548 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `paperExecutionFees()` connect `Community 65` to `Community 56`, `Community 89`, `Community 85`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `simulateFiveMinute()` connect `Community 85` to `Community 65`, `Community 69`, `Community 10`, `Community 89`, `Community 91`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `discoverStocks()` connect `Community 79` to `Community 0`, `Community 2`, `Community 71`, `Community 84`, `Community 25`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `tsBuildInfoFile`, `target`, `lib` to the rest of the system?**
  _553 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05994397759103642 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04440333024976873 - nodes in this community are weakly interconnected._
- **Should `Community 7` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._