# Graph Report - ai-algo-trading-india  (2026-09-19)

## Corpus Check
- 91 files · ~57,829 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 567 nodes · 997 edges · 50 communities (39 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47acfbe1`
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

## God Nodes (most connected - your core abstractions)
1. `apiUrl()` - 27 edges
2. `compilerOptions` - 19 edges
3. `compilerOptions` - 16 edges
4. `useStockDiscovery()` - 15 edges
5. `simulateBacktest()` - 13 edges
6. `openPaperTrades()` - 13 edges
7. `DiscoveredStock` - 12 edges
8. `updatePaperTrades()` - 12 edges
9. `scripts` - 11 edges
10. `runScan()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `scan()` --calls--> `discoverStocks()`  [INFERRED]
  scripts/signal-worker.mjs → src/services/stockDiscovery.ts
- `handler()` --calls--> `allowRequest()`  [EXTRACTED]
  api/proxy.js → server/pushBackend.js
- `handler()` --calls--> `allowRequest()`  [EXTRACTED]
  api/market.js → server/pushBackend.js
- `handler()` --calls--> `allowRequest()`  [EXTRACTED]
  api/health.js → server/pushBackend.js
- `handler()` --calls--> `dispatchAlerts()`  [EXTRACTED]
  api/dispatch-alerts.js → server/dispatchAlerts.js

## Communities (50 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (57): money(), OverviewPage(), SignalsPage(), money(), TradesPage(), listeners, publish(), runScan() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (36): IPOPage(), angelOneApplyIPO(), angelOneLogin(), autoApplyForIPO(), AutoApplySettings, BrokerConfig, dhanApplyIPO(), dhanFetchIPOList() (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (20): AlertsPage(), DiscoveryPage(), StockCard(), SignalPopup(), SmartPicksPage(), StockCard(), StockAnalysisPage(), useLiveStocks() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (10): ALLOCATION, MetalsPage(), signalStyles, fetchChart(), fetchIndianRetailPrices(), fetchLiveMetals(), IndianRetailPrices, LiveMetal (+2 more)

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
Cohesion: 0.08
Nodes (34): env, handler(), handler(), handler(), handler(), handler(), db, scan() (+26 more)

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

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (11): scripts, build, check:deployment, dev, lint, mobile:android, mobile:ios, mobile:sync (+3 more)

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
Nodes (12): computeBollingerPosition(), computeEMA(), computeFOAnalysis(), computeMACD(), computeOverallSignal(), computeSMA(), FOAnalysis, StrategyScores (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): Limitations, Release gate, Required configuration, Root cause, Vercel release and Android backend setup, Verification

## Knowledge Gaps
- **196 isolated node(s):** `tsBuildInfoFile`, `target`, `lib`, `types`, `skipLibCheck` (+191 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiUrl()` connect `Community 1` to `Community 3`, `Community 5`, `Community 6`, `Community 47`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `discoverStocks()` connect `Community 0` to `Community 8`, `Community 1`, `Community 47`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `scan()` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `tsBuildInfoFile`, `target`, `lib` to the rest of the system?**
  _196 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08281573498964803 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08313725490196078 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07317073170731707 - nodes in this community are weakly interconnected._