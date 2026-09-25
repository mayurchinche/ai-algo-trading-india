# Graph Report - ai-algo-trading-india  (2026-09-25)

## Corpus Check
- 127 files · ~58,981 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 826 nodes · 1575 edges · 71 communities (58 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e0482cb7`
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
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]

## God Nodes (most connected - your core abstractions)
1. `apiUrl()` - 27 edges
2. `formatIST()` - 27 edges
3. `compilerOptions` - 19 edges
4. `istDate()` - 17 edges
5. `compilerOptions` - 16 edges
6. `advancePaper()` - 16 edges
7. `useStockDiscovery()` - 16 edges
8. `runScan()` - 15 edges
9. `DiscoveredStock` - 15 edges
10. `openPaperTrades()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `advancePaper()` --calls--> `event`  [INFERRED]
  server/paperEngine.js → tests/paper-database.mjs
- `adjustment()` --calls--> `transferPaperFunds()`  [EXTRACTED]
  tests/paper-funds.test.ts → server/paperFunds.js
- `cycle()` --calls--> `fetchQuotes()`  [INFERRED]
  scripts/paper-worker.mjs → src/services/stockDiscovery.ts
- `ticket()` --calls--> `newPaperAccount()`  [EXTRACTED]
  tests/paper-workflow.test.ts → server/paperEngine.js
- `step()` --calls--> `advancePaper()`  [EXTRACTED]
  tests/paper-engine.test.ts → server/paperEngine.js

## Communities (71 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (78): AlertsPage(), SignalsPage(), StockAnalysisPage(), LegacyTradesPage(), money(), TradesPage(), listeners, publish() (+70 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (18): IPOPage(), angelOneApplyIPO(), angelOneLogin(), autoApplyForIPO(), AutoApplySettings, BrokerConfig, dhanApplyIPO(), dhanFetchIPOList() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (8): computeBollingerPosition(), computeEMA(), computeFOAnalysis(), computeMACD(), computeOverallSignal(), computeSMA(), FOAnalysis, StrategyScores

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
Cohesion: 0.08
Nodes (42): OpportunityCard(), money(), OverviewPage(), PaperAmendment(), PaperEvidencePanel(), Action, ExecutionSettings, PaperIntent (+34 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (18): PaperExecutionPanel(), advanceWorkflow(), amendPendingEntry(), cancelEntryRemainder(), configureExecution(), DEFAULT_EXECUTION, live, record() (+10 more)

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
Cohesion: 0.17
Nodes (11): maxDuration, buildCommand, crons, framework, functions, api/*.js, installCommand, outputDirectory (+3 more)

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
Nodes (40): env, handler(), handler(), handler(), handler(), handler(), accounts(), candidates (+32 more)

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (12): scripts, build, check:deployment, dev, lint, mobile:android, mobile:ios, mobile:sync (+4 more)

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
Cohesion: 0.11
Nodes (18): Acceptance for this delivery, Continuation, Daily workflow implementation — v1.4.0, Delivery evidence, Errors, Goal, Order controls completion, Paper brokerage experience — phased implementation (+10 more)

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): Limitations, Release gate, Required configuration, Root cause, Vercel release and Android backend setup, Verification

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (4): json(), market(), now, requireProductionData

### Community 50 - "Community 50"
Cohesion: 0.14
Nodes (13): Android test build, Android test builds, Cumulative balance and funding verification build, Latest: v1.1.0 — no login, direct Paper trades, Latest: v1.2.0 — IPO layout and paper workspace, Latest: v1.3.0 — signal tickets and order controls, Persistent paper account verification build, Previous backend test build (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.22
Nodes (8): before, data, now, old, queue, result, saved, stock

### Community 52 - "Community 52"
Cohesion: 0.20
Nodes (9): Broker-style paper trading design, Data and operation dependencies, Next slice: tickets and intentional delay, Primary sources, Product-specific activation requirements, Recorded journey, Remaining dependencies, Strategy research and promotion (+1 more)

### Community 54 - "Community 54"
Cohesion: 0.25
Nodes (7): Default: no sign-in required, Deployment required before activation, Execution semantics, Historical balance and paper funding, Optional server mode: deployment required before activation, Persistent paper trading, Verification

### Community 56 - "Community 56"
Cohesion: 0.13
Nodes (17): newPaperAccount(), blocked, candidate, filled, pending(), q(), quote(), r (+9 more)

### Community 57 - "Community 57"
Cohesion: 0.15
Nodes (10): ALLOCATION, MetalsPage(), signalStyles, fetchChart(), fetchIndianRetailPrices(), fetchLiveMetals(), IndianRetailPrices, LiveMetal (+2 more)

### Community 58 - "Community 58"
Cohesion: 0.30
Nodes (10): fetchNifty(), fetchSingleStock(), YahooChartMeta, fetchMarketStatus(), MarketStatus, fetchHistorical(), fetchScreener(), apiUrl() (+2 more)

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (10): ALLOTMENT_TIPS, fetchLiveIPOs(), fetchSubscriptionData(), financialYear(), isFreshIPOCache(), parseIPORows(), scoreIPO(), stripHtml() (+2 more)

### Community 60 - "Community 60"
Cohesion: 0.20
Nodes (7): parseMetalChart(), config, data, now, requests, res, result

### Community 61 - "Community 61"
Cohesion: 0.14
Nodes (16): SignalPopup(), useLiveStocks(), useNativeAlerts(), useTradingRuntime(), ForegroundAlert, AlertsPage, App(), BacktestPage (+8 more)

### Community 62 - "Community 62"
Cohesion: 0.13
Nodes (12): adjustment(), b, legacy, next, now, open, original, r (+4 more)

### Community 63 - "Community 63"
Cohesion: 0.17
Nodes (3): NSE_FO_SYMBOLS, OptionLeg, OptionsStrategy

### Community 64 - "Community 64"
Cohesion: 0.24
Nodes (6): SmartPicksPage(), StockCard(), generateOptionsPicks(), OptionsPick, StoredSignal, DiscoveredStock

### Community 65 - "Community 65"
Cohesion: 0.31
Nodes (7): advancePaper(), cost(), day(), minute(), round(), db, event

### Community 66 - "Community 66"
Cohesion: 0.56
Nodes (7): handler(), fundedCapital(), importLegacyPaper(), PaperAccountError, paperBalance(), round(), transferPaperFunds()

### Community 67 - "Community 67"
Cohesion: 0.38
Nodes (5): DeviceLedger, devicePaperSymbols(), deviceSymbols(), read(), RecordData

### Community 69 - "Community 69"
Cohesion: 0.33
Nodes (4): alerts, now, sell, storage

## Knowledge Gaps
- **327 isolated node(s):** `tsBuildInfoFile`, `target`, `lib`, `types`, `skipLibCheck` (+322 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiUrl()` connect `Community 58` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 57`, `Community 59`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `advancePaper()` connect `Community 65` to `Community 66`, `Community 67`, `Community 8`, `Community 56`, `Community 25`, `Community 62`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `discoverStocks()` connect `Community 25` to `Community 0`, `Community 2`, `Community 60`, `Community 58`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `tsBuildInfoFile`, `target`, `lib` to the rest of the system?**
  _327 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.061711079943899017 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.0825136612021858 - nodes in this community are weakly interconnected._
- **Should `Community 7` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._