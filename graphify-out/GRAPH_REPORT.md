# Graph Report - ai-algo-trading-india  (2026-09-20)

## Corpus Check
- 107 files · ~53,469 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 683 nodes · 1265 edges · 57 communities (47 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `08826091`
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

## God Nodes (most connected - your core abstractions)
1. `apiUrl()` - 27 edges
2. `compilerOptions` - 19 edges
3. `formatIST()` - 19 edges
4. `compilerOptions` - 16 edges
5. `useStockDiscovery()` - 16 edges
6. `istDate()` - 16 edges
7. `openPaperTrades()` - 15 edges
8. `simulateBacktest()` - 13 edges
9. `freshQuote()` - 13 edges
10. `scripts` - 12 edges

## Surprising Connections (you probably didn't know these)
- `advancePaper()` --calls--> `event`  [INFERRED]
  server/paperEngine.js → tests/paper-database.mjs
- `discover()` --calls--> `discoverStocks()`  [INFERRED]
  scripts/paper-worker.mjs → src/services/stockDiscovery.ts
- `cycle()` --calls--> `fetchQuotes()`  [INFERRED]
  scripts/paper-worker.mjs → src/services/stockDiscovery.ts
- `scan()` --calls--> `discoverStocks()`  [INFERRED]
  scripts/signal-worker.mjs → src/services/stockDiscovery.ts
- `adjustment()` --calls--> `transferPaperFunds()`  [EXTRACTED]
  tests/paper-funds.test.ts → server/paperFunds.js

## Communities (57 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (71): AlertsPage(), SignalsPage(), listeners, publish(), runScan(), scan(), state, CandidateDecision (+63 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (18): IPOPage(), angelOneApplyIPO(), angelOneLogin(), autoApplyForIPO(), AutoApplySettings, BrokerConfig, dhanApplyIPO(), dhanFetchIPOList() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (13): SmartPicksPage(), StockCard(), generateOptionsPicks(), NSE_FO_SYMBOLS, OptionLeg, OptionsPick, OptionsStrategy, StoredSignal (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (11): ALLOCATION, MetalsPage(), signalStyles, fetchChart(), fetchIndianRetailPrices(), fetchLiveMetals(), IndianRetailPrices, LiveMetal (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (10): devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (22): BacktestPage(), BacktestConfig, BacktestResult, BacktestTrade, breakoutSignal(), computeATR(), computeBollingerBands(), computeDirectionAccuracy() (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (17): Header(), HeaderProps, LiveStock, getNotificationSettings(), NotificationSettings, notify(), notifyDailySummary(), notifyIPOAllotment() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (40): handler(), advancePaper(), cost(), day(), minute(), newPaperAccount(), round(), fundedCapital() (+32 more)

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
Nodes (39): env, handler(), handler(), handler(), handler(), handler(), accounts(), candidates (+31 more)

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
Cohesion: 0.38
Nodes (8): fetchNifty(), fetchSingleStock(), YahooChartMeta, fetchHistorical(), fetchScreener(), apiUrl(), PROXY_MAP, fetchMarketJSON()

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): Limitations, Release gate, Required configuration, Root cause, Vercel release and Android backend setup, Verification

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (4): json(), market(), now, requireProductionData

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (6): Android test build, Android test builds, Persistent paper account verification build, Previous backend test build, Production-data audit build — 20 September 2026, Strong-signal policy update — 20 September 2026

### Community 51 - "Community 51"
Cohesion: 0.12
Nodes (28): DiscoveryPage(), StockCard(), money(), OverviewPage(), FundingState, money(), PaperBalance, PaperFundsPanel() (+20 more)

### Community 52 - "Community 52"
Cohesion: 0.24
Nodes (9): ALLOTMENT_TIPS, fetchLiveIPOs(), fetchSubscriptionData(), financialYear(), isFreshIPOCache(), parseIPORows(), stripHtml(), SubData (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.20
Nodes (7): scoreIPO(), config, data, now, requests, res, result

### Community 54 - "Community 54"
Cohesion: 0.33
Nodes (5): Deployment required before activation, Execution semantics, Historical balance and paper funding, Persistent paper trading, Verification

### Community 55 - "Community 55"
Cohesion: 0.16
Nodes (8): computeBollingerPosition(), computeEMA(), computeFOAnalysis(), computeMACD(), computeOverallSignal(), computeSMA(), FOAnalysis, StrategyScores

## Knowledge Gaps
- **251 isolated node(s):** `tsBuildInfoFile`, `target`, `lib`, `types`, `skipLibCheck` (+246 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `advancePaper()` connect `Community 8` to `Community 25`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `cycle()` connect `Community 25` to `Community 8`, `Community 0`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `fetchQuotes()` connect `Community 0` to `Community 25`, `Community 55`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `tsBuildInfoFile`, `target`, `lib` to the rest of the system?**
  _251 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06265389876880985 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08465608465608465 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.13725490196078433 - nodes in this community are weakly interconnected._