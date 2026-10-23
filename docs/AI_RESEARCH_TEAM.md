# Autonomous research team

`node research/team/loop.mjs [--rounds 8] [--model m]` runs researcher → product → designer → engineer → QA (one `copilot -p` each) on branch `team/<date>`, looping until a strategy is ACCEPTED on the locked holdout (GOAL = avg ≥ 3%/month) or rounds / holdout budget run out. Result: `docs/team/FINAL.md`.

Guard rails (`research/team/gates.mjs`, hash-checked; agents cannot edit it, the loop aborts if protected files change):
- Agents see data only to 2024-06-30; holdout 2024-07 → today, one look per strategy, 3 looks total.
- Every evaluation is counted; the required monthly t-stat rises with the count (≈3.6 at 34 variants).
- Causality audit (truncation invariance) fails closed on look-ahead; checked by `node research/team/gates.check.mjs`.
- Limits: worst month ≥ −4%, max DD ≥ −10%, ≥70% positive months, avg > 0, after costs.
- Never touches live books or main; a human promotes. 3%/month may be unreachable; the loop reports that honestly.

Results so far: docs/team/SCREEN_164.md (164 strategies × 2 configs, consensus mixes, momentum). Run: `node research/team/screen.mjs [--cfg B]`, `--merge`, `ensembles.mjs`, `round3.mjs`.
