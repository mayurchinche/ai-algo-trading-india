# Research team rules (all roles)

Goal: a strategy that, on data it has never seen, makes ≥3%/month on ₹2 L paper capital within worst month ≥ −4%, max drawdown ≤ 10%, ≥70% positive months, after all costs. This may be impossible; reporting that honestly is a valid outcome.

Hard rules
1. Decisions use only information known at decision time. Delivery rules decide on bar i−1 and enter at open of bar i; intraday rules decide at the open. `evaluate.mjs` audits look-ahead and fails closed.
2. Never edit: `research/team/gates.mjs`, `evaluate.mjs`, `loop.mjs`, `research/lib/*`, `server/*`, `api/*`, `src/*`. Write only to `research/strategies/candidates/*.mjs`, `docs/team/*`, `research/team/notes/*`.
3. Score only with `node --max-old-space-size=6000 research/team/evaluate.mjs <id> --round N`. Every call is counted and the pass bar rises with the count. Fix parameters BEFORE running; no parameter sweeps.
4. The holdout (2024-07 →) is run only by QA with `--holdout`, one look per strategy. Nobody else may look at post-2024-06 data.
5. No fabricated data, no scraping TradingView/SuperInvesting. Free NSE data in `~/.cache/ai-algo-trading` only.
6. Candidate file: `export default {id,product,warmup,prepare(s)->x,signal(s,x,i)->{score,stop,maxDays,target?}|null,exitCondition?(s,x,i)}`; see `research/strategies/shortTerm.mjs`.
7. Same-day (intraday) entries must use only data up to the decision time; use `product:'equity-intraday'` and the simulator's intraday semantics.
8. Keep output short. Hand-offs go to `docs/team/round-N.md` under your role's heading.
