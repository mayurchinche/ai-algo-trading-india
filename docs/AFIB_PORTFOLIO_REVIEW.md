# AFIB paper review and portfolio research feature

Reviewed 4 October 2026. Source: uploaded `2603.08704v1.pdf`, 12 pages, *Evaluating Financial Intelligence in Large Language Models: Benchmarking SuperInvesting AI with LLM Engines*. Public record: https://arxiv.org/abs/2603.08704 (v1, 9 March 2026).

## What the paper establishes, and what it does not

AFIB evaluates answers to financial-analysis questions concerning Indian equities. It is relevant to our research quality controls; it is not an automated-trading performance study. Its model leaderboard is neither an allocation weight nor a probability of a profitable trade. Section VI explicitly places portfolio construction and derivatives pricing in future work. There are no executed strategy returns, brokerage-adjusted portfolio returns, drawdown comparisons, walk-forward trials or investable stock-selection rules from which to estimate our profitability.

Useful ideas: verify numerical claims against original filings; distinguish fiscal periods; reason about sector-specific business drivers; require complete answers and citations; capture news recency; repeat equivalent questions; record failure types. These support the existing point-in-time evidence policy.

Important limitations from inspecting the text and figures:

- The abstract and Figure 1 say 95+ questions, whereas the introduction/contributions say 71. Dataset scope cannot be reconstructed reliably from that description.
- The methodology says five equally weighted dimensions. Several figures display six dimensions; a reproducible mapping to the overall score is not supplied in the PDF.
- Claude's accuracy and consistency bars in Figure 3 differ materially from its cells in Figure 6. Do not use these figures as calibrated model-selection evidence.
- Model brands are named, but precise versions, run dates, retrieval/tool configurations, judge calibration and uncertainty intervals are not sufficiently specified for a like-for-like reproduction.
- The consistency formula `1 - Var(V(R_i))` needs an explicit scale/normalization: otherwise changing numerical units changes the score.
- Refusals reduce some scores. We should preserve appropriate abstention rather than reward confident, unsupported completeness.
- Supplementary questions and outputs are mentioned; they were not included in the supplied PDF. The 432 negative production responses mentioned in the introduction do not supply a representative failure-rate denominator here.

Therefore: use this paper as a checklist for research reliability, not a demonstrated route to top-1% returns or a reason to buy its winning product.

## Implemented first version

`Portfolios` is a separate workspace available from all trading segments on web/mobile layouts. It creates immutable shared-user1 research proposals for short-term and long-term delivery equities. These are independent research budgets, not additional paper-account deposits, holdings or orders.

The user defines name, horizon, budget, stock cap, sector cap, cash reserve, holding count and total planned stop-loss budget. Defaults are research settings, not optimized investment recommendations. The server reads the selected shared account's retained signals (up to 200), obtains available Upstox quotes, reassesses facts at the new decision time and records exact blockers.

Eligibility requires a current long equity candidate, point-in-time evidence and cited thesis, verified sector classification, fresh observed book, quantity compatible with the cited risk plan, and concentration/cash/risk checks. Costs consume the available budget; retained cash is never force-allocated. Allocation ordering is explicitly alphabetical, not an alpha model. Any positive proposal remains REVIEW_REQUIRED and cannot authorize trades.

UI shows saved history, decision/storage timestamps, allocation estimates, source coverage, per-candidate exclusions, cited evidence and JSON export. Returns/drawdown remain unavailable because no portfolio has been executed. HTTP/database failures are distinct from no recorded candidates. Requests are idempotent; browser retries cannot overwrite decisions or duplicate the same request. Android routes the new API to the configured server base.

Storage: `20261004_research_portfolios.sql`, restricted to server access with RLS; immutable rows and service-only write RPC; at most 50 proposals, with no automatic deletion of research decisions. Existing paper tables, balances, schedules and orders are untouched. This shared workspace intentionally inherits the app's user1/no-login policy; it is not a multi-user private portfolio service.

## Acceptance checks

- Client cannot submit facts, quotes, eligibility or fill prices.
- Late, stale, conflicting or absent evidence cannot qualify by technical score.
- Allocation plus estimated costs respects cash reserve; stock, sector, count and aggregate planned-loss limits hold.
- No fractional equity quantities; no uncited rescaling of risk plans; no derivatives in delivery allocation.
- Same request returns the original snapshot, even after data changes; changed mandate using that request ID conflicts.
- SQL rejects backdating and denies direct anonymous/authenticated writes. Service clients can read but cannot rewrite stored rows.
- Missing storage is HTTP 503, not successful empty history. No browser-only fallback.

## Remaining work before a genuinely evidence-driven investment portfolio

1. **Authoritative fundamentals adapters.** Ingest dated exchange/company filings, document hashes, audited/consolidated versus standalone scope, fiscal periods, accounting units and restatements. Calculate ratios in code from cited inputs. Do not ask an LLM to invent missing data.
2. **Sector research specifications.** Banks: asset quality, capital adequacy and deposit economics; industrials: order conversion, working capital and cash flow; IT: growth, margins and client concentration; consumer businesses: volume, pricing and distribution. Validate any thresholds on historical point-in-time data rather than importing arbitrary common cutoffs.
3. **Thesis pipeline.** Evidence retrieval → structured analysis → independently checked numerical claims → contrary evidence review. Capture model/version, prompt, input snapshot, output and review results. No model provider has been purchased or enabled by this change.
4. **Portfolio construction experiments.** Compare prespecified equal-weight, concentration-constrained and risk-based allocations. Correlation, transaction costs, liquidity, dividends, corporate actions and turnover must be modeled consistently. An index total-return and a simple equal-weight baseline are candidates for comparison, not guaranteed targets.
5. **Historical then forward validation.** Freeze policy, universe, data availability times and experiment definitions before evaluating. Handle delistings, survivorship, reporting lag, splits/dividends and missing observations. Report net returns, drawdown, exposure, turnover, uncertainty and no-trade coverage by regime. Use the existing evidenceComparison contract; no such portfolio study has been run by this implementation.
6. **Execution integration only after review.** Immutable approved proposal → separately funded paper portfolio → fresh executable prices → auditable orders/fills/exits → daily valuation. Never convert reference asks into historical fills.

Current production fundamentals and supported theses are not yet supplied to the segment signals. Consequently, current candidates will remain unallocated under this policy. A live Upstox token alone does not fill those gaps.

## Release requirements

Apply the additive Supabase migration, deploy the code, verify cross-device shared history against the real database, and rebuild/install Android to expose the new navigation. Local build/tests cannot establish those production steps. Migration installation and actual portfolio returns must be reported separately from code completion.

## Local verification completed

Production build and lint passed. The full suite passed 200 tests plus nine database integration checks, including the new portfolio API, allocation constraints, no-look-ahead evidence, idempotency, shared schema access controls and immutable history. Browser inspection confirmed the creation form and explicit storage failure state at the available preview size and 390px phone width, with no horizontal page overflow. Successful saved-history rendering against production Supabase and an Android APK installation have not been verified. No production migration or deployment was performed in this change.

## Business research requirements added 4 October 2026

Every new portfolio candidate now receives a separate `business-research-v1` assessment covering global exposure/opportunity/downside, earnings impact, valuation and invalidation; order commitments, execution, economics and collection risk; and management delivery, allocation, ownership and governance. Missing coverage or an adverse outlook blocks proposed allocation. Coverage is explicitly not automated verification of an investment thesis. Existing saved proposals are neither backfilled nor rewritten.

Banking and insurance classifications replace industrial orders with their corresponding growth, funding/retention and capital requirements. Other classifications currently use the industrial order-book specification; extending the reviewed sector taxonomy remains necessary before broad sector coverage can be claimed.

Adapter contract: each claim has `text` and `factIds`, under `thesis.businessResearch.global`, `.orders` or `.management`, with an explicit `outlook`. Facts must already pass the point-in-time evidence filter. At least one citation must match the field's category/key and have a reviewed primary `documentType` (company filing, exchange announcement, annual report, earnings transcript or official policy). All cited IDs must remain available at decision time. These are source-adapter assertions, not an automatic authenticity check of arbitrary URLs. Public API requests cannot submit these fields.

Order commitments require `commitmentStatus=CONFIRMED` or an evidenced `NONE_DISCLOSED`; a bid/expectation is insufficient. This captures disclosed status, not guaranteed revenue or margin. Management delivery requires distinct `management:delivery.guidance` and `management:delivery.actual` facts, respectively marked `GUIDANCE` and `ACTUAL_OUTCOME`, for the same `financialPeriod`, with guidance published before the outcome. Distinct keys preserve both observations through the existing latest-revision filter. A reviewed comparison, not a computed management score, is shown.

The portfolio page displays all research requirements even when no proposals exist; each saved candidate displays its coverage, outlook, supported assessments and dated source links. Historical proposals without this assessment explicitly say it was not recorded. Verified filing ingestion and automatic thesis creation remain unconnected; this change does not pretend to have completed company research or validated investment returns.

## Live company disclosure acquisition

The portfolio workspace now includes an NSE disclosure inbox backed by the official announcement RSS feed, documented at https://www.nseindia.com/static/rss-feed . The live Node adapter was verified on 4 October 2026: six feed entries were retrieved, and a linked SICALLOG structured order filing was parsed successfully. This establishes source access and field extraction, not the company's investment merit or future returns.

Only the fixed NSE archive host is fetched. Publication times in the feed are parsed explicitly as IST; retrieval times are recorded separately. The bounded XML reader rejects DTDs/entities, unsafe document URLs, future dates and malformed responses. A five-minute cache preserves original receipt timestamps. Document IDs must resolve to the current feed; callers cannot submit arbitrary download URLs. Legal/regulatory "orders passed" are not classified as business order wins.

The supported structured order schema reports issuer identity, customer, domestic/international classification, value with a declared currency, execution terms and related-party declaration. Missing, repeated or mismatched-context fields remain unavailable. Unsupported schemas and PDFs direct users to the original document. No PDF text parsing, ratio calculation, automatic semantic verification or LLM is claimed. Document previews are transient; each newly saved portfolio captures the current feed index or an explicit unavailable status in its immutable source snapshot. Neither the feed nor these issuer-reported fields are promoted to VERIFIED thesis facts.

The feed is a recent rolling sample. It cannot establish complete company coverage or historical point-in-time evidence before we first observed it. Portfolio save and cross-device persistence still require the existing research portfolio migration and authenticated production deployment; no Supabase connector is available in this session, and no production schema or deployment has been changed in this step.

## Integrated financial filing preview

The disclosure inbox now supports the official NSE Integrated_Filing_Financials.xml RSS feed alongside announcements. The separate legacy Financial_Results.xml sample contained old reporting periods and stale publication dates; it was not treated as current evidence. Both adapters retain their fixed-host URL restrictions and 30-day publication window.

Supported financial XML exposes issuer identity, standalone/consolidated scope, duration context, revenue from operations, continuing-operations profit and total period profit. Values retain raw text, declared currency and XBRL precision; decimals is never used as a scale multiplier. Missing/duplicate facts, unknown/divided currencies, segmented contexts and invalid periods remain unavailable. Ratios require positive revenue and compatible currency within one context; no annualisation, cross-period growth or operating-margin claim is made. A filing revision is a new observation, never evidence available at the original period end.

Live browser validation on 4 October 2026 retrieved 20 financial feed entries and opened PRANAV's consolidated April–June 2026 filing published 1 October at 20:15:12 IST. Revenue was INR 1,645,400,000, continuing-operations profit INR 143,760,000, and their ratio 8.74%. This validates extraction against that filing, not investment quality. The UI shows source publication and document-read times, original filing links and content hash.

Build, lint, 219 tests and nine database integration checks passed. New regression cases cover precision, zeros/losses, unavailable/duplicate/nil/scaled inputs, incompatible units, future/segmented/duplicate contexts, separation of periods and API feed selection. Financial previews remain transient and are not saved in the portfolio snapshot; only the announcement index is currently captured. No extracted financial is automatically promoted to VERIFIED candidate evidence. Balance-sheet/cash-flow ratios, sector comparisons, management review, durable financial observations and return validation remain subsequent work. No production deployment, Supabase migration or Android rebuild was performed.

## Financial evidence in saved proposals

New proposals now capture the integrated financial feed and a bounded sample of its latest four XML filings, including parsed periods, original values, calculations, currency/precision, publication/read timestamps and document hashes. This is a market-wide sample, not company-complete coverage. Unsupported documents, provenance mismatches, oversized extraction results and source failures are explicit outcomes. Individual extracted documents are limited to 50 KB; full original XML is not archived. The JSON export preserves extracted figures even if the linked original changes.

The financial snapshot is inside the existing hashed immutable portfolio report, saved through the same server-only RPC. An idempotent retry returns the original proposal without fetching newer financial observations. The UI exposes saved filing links/times/hashes and failures; older proposals explicitly indicate that financial evidence was not recorded. These observations are not promoted to VERIFIED thesis evidence and cannot unblock allocations.

Local verification: build and lint passed; 223 tests and nine database checks passed, with persistence and retry assertions added for financial evidence. A live public NSE check captured four of 20 feed entries, reporting 16 not selected. Production persistence and saved-history UI remain unverified because the portfolio migration/deployment is still outstanding. No production release or Android rebuild occurred. Next work remains company-specific historical coverage, sector ratios and reviewed thesis construction before portfolio return testing.

## Candidate-specific financial evidence links

Each new candidate assessment now records instrument-exact financial links into its saved source snapshot. No company-name or ticker similarity matching is used. Publication must precede observation, observation must be no later than capture, and capture must be no later than the proposal decision. Missing historical snapshots, source outages, invalid snapshot timing and no match in the limited sample have distinct statuses. Original/revised and standalone/consolidated documents remain separate; no preferred revision or comparable period is inferred.

The candidate evidence view displays linked reported values, reporting scopes/periods, explicit unavailable figures, ratio values, original links and recorded timestamps/hashes. Historical proposals without this mapping are labelled accordingly rather than recomputed against today's feed. Mapping is review context only and does not alter the verified-fact gate or allocation eligibility.

Validation: build/lint passed, 228 tests and nine database checks passed. Tests cover identity mismatch, future/reversed/invalid timestamps, distinct missing states, candidate rendering, immutable report hashing and unchanged allocation eligibility. The test bundler now uses the automatic JSX runtime, consistent with the app, for component rendering tests. Live NSE verification linked PRANAV's two captured filings by instrument identity, preserving Consolidated and Standalone scopes. No production deployment, migration or Android rebuild was performed; actual saved-proposal browser/cross-device verification remains pending. The four-document rolling sample still cannot establish company-complete historical coverage or profitability.

## Portfolio-level evidence coverage

New immutable reports include candidate-level financial filing coverage, distinct linked filing count, an explicit list of company evidence gaps and ranked exclusion reasons. Coverage counts unique assessed candidates with at least one linked filing, not the number of revisions or financial metrics. No candidates yields null coverage, not zero or 100 percent. Each exclusion reason counts a candidate once; reasons can overlap. Historical proposals without a saved summary are labelled rather than recomputed using current sources.

The new UI panel shows this summary alongside candidate evidence. Even full sample-link coverage does not establish complete financial history, freshness, investment quality or profitability. This addition does not relax allocation gates or make the rolling feed company-complete.

Validation: production build and lint passed; 232 tests and nine database integration checks passed, including server-rendered coverage states, revision counting, explicit missing/outage distinctions and non-additive exclusion reasons. Browser layout and saved production report rendering remain unverified. No deployment, migration or APK rebuild occurred in this phase.

## SCRAP foundation: company-specific annual-report histories

Implemented the first SCRAP acquisition phase using the annual-report endpoint referenced by NSE's own corporate-filings page script: https://www.nseindia.com/companies-listing/corporate-filings-annual-reports . The new /api/company-history endpoint accepts an exact uppercase symbol and Equity/SME segment, retrieves a bounded response from a fixed NSE URL, caches original receipt timestamps for five minutes, rejects unsafe document links and preserves revisions. It exposes up to 20 indexed reports; response failures are unavailable, never a valid empty history. Links point only to NSE archive PDF/ZIP reports; no archives are downloaded or executed.

Public availability uses disseminationDateTime, separately from broadcast/submission time and financial year. Missing dates remain null and cannot be inferred from filenames. This is an index observed now, not a claim that the app possessed the documents historically. Symbol searches are not independently verified ISIN mappings; corporate name/symbol changes and missing index records remain coverage limitations. The website endpoint is not a contracted data service and may become unavailable or change schema.

Portfolios now provide a live company-history search and five explicit SCRAP review groups: sector/value migration, quality/growth/valuation, governance/rejection, capital allocation, and holding discipline. All start NOT_ASSESSED. The 15%/25% growth targets are saved as unvalidated screening hypotheses. Each newly saved proposal includes a dated snapshot of indexes for at most three unique candidate symbols, selected alphabetically using Equity only, plus omitted symbols and explicit failed observations. Manual searches are not automatically saved. The immutable existing report hash/export includes these records and the versioned SCRAP requirements. No governance verdict or allocation gate is inferred from finding an annual report.

Verified locally on 4 October 2026: live INFY lookup returned 17 entries including original and revised FY2025–26 filings, older PDF/ZIP links and missing public timestamps. Browser search and layout were checked at the existing preview viewport. Build, lint, 237 tests and nine database checks passed. Production snapshot persistence, Equity/SME breadth, Android rendering and deployment remain unverified. No migration, production release or APK rebuild occurred.

### Remaining SCRAP phases

1. Parse bounded PDF/structured annual-report content with page/section provenance, identity checks and unsupported/OCR states. Extract audit opinion, qualifications, fees, remuneration, ownership/pledges, related parties and financial statements; never classify absent extraction as a clean audit.
2. Store reviewed company/period/scope facts and separate factual findings from allegations, audit key matters and analyst inference. Serious unresolved findings must not be averaged away by growth scores.
3. Implement sector-specific quality/growth/capital-allocation measures using comparable periods, units and reporting scopes. Link macro/regulatory/technology catalysts to primary evidence; distinguish organic, acquisition, base-effect and diluted-per-share growth.
4. Add bear/base/bull valuation, implied expectations, financing needs and dated thesis/invalidation reviews. No universal banking/industrial metric substitutions.
5. Freeze data availability, universe, policy and baselines before historical/forward evaluation; include failed/delisted names, costs, turnover, liquidity and uncertainty. Do not present sample-link coverage as a probability of multibagger returns.

## PDF topic passage extraction

Annual-report PDF entries now offer on-demand auditor/governance passage discovery using pinned Mozilla pdfjs-dist 6.4.299 on the Node backend. The API accepts a report ID only if it belongs to the current company/segment index; callers cannot submit download URLs. It revalidates fixed archive hosts/paths, refuses redirects and ZIP extraction, caps downloads at 12 MB, caps documents at 600 pages and extracted text at eight million characters, and checks an extraction deadline between pages. Limits are bounded best-effort processing, not a hard per-page CPU sandbox. Two concurrent extractions and five cached results per server instance limit resource use; no global distributed rate limit is implemented. The endpoint has a 60-second Vercel duration setting; actual deployed runtime compatibility is not yet proven.

Six topic groups locate passages for audit opinions/changes, auditor fees, remuneration, related parties/ownership, cash-flow/accounting and capital allocation. Results retain physical PDF page number, surrounding text, document byte hash, source URL, publication and receipt timestamps. At most three passages per topic are returned, while all matching pages are counted. These are text matches, not semantic findings, numeric interpretations or governance clearance. Missing matches are not evidence of absence. Low-text pages are counted; image-only documents explicitly require OCR/manual review. Text ordering may include adjacent table cells; the UI links to original pages for review. No PDF script execution or LLM interpretation is used.

Live local extraction of the indexed Infosys revised annual report processed 384 physical pages, 382 with usable text and two low-text pages. A sampled auditor-fees passage on physical page 101 was visually checked against the rendered source (printed page label 131), demonstrating why physical-page labels are explicit. Build, lint, 242 tests and nine database checks passed. Regression tests cover negation preservation, bounded excerpts, missing-text status, identifier/URL restrictions, document hashing and cache timing. These previews are not durable portfolio evidence yet and do not change SCRAP assessment or allocation gates. Production deployment, cross-device persistence and full financial/governance extraction remain outstanding.

## Shared archive for extracted report evidence

Added a separate immutable user1 report-evidence archive, with an additive Supabase migration and server-only write RPC. The save API accepts only symbol, segment, current report identifier, the viewed document hash and a UUID retry key. It retrieves the source on the server and rejects a changed PDF hash; client-supplied passages cannot be persisted. Retry identity conflicts return 409; successful retries return the original record without fetching or rewriting it. Entries retain extracted passages, physical page numbers, original source URL, publication/observation times and byte hash. Original PDF bytes are not archived. Saved evidence remains unverified and is not automatically attached to portfolio proposals.

The UI offers an explicit save button and a shared archive reader. Schema failures show unavailable rather than local success. Storage is capped at 200 observations, with no automatic deletion; migration checks enforce maximum size, observation freshness and permitted extraction statuses. Database roles cannot directly mutate records, and browser roles have no direct table access. As elsewhere in the current shared-user1 app, the backend API is a shared workspace rather than user-private storage; this phase does not introduce per-user authentication.

Local build/lint and 245 tests plus ten database checks passed. API regressions cover server-only content, source changes, idempotent retries and sanitized failure states; SQL checks cover migration idempotency, preserved passage JSON, no backdating and denied direct writes/deletes. Production migration/deployment and successful cross-device archive rendering remain unverified. No production schema, deployment or APK changes were performed.

## Archive evidence attached to new portfolio snapshots

New proposals now read the shared report archive and capture up to five matching Equity documents (200 KB total), including the exact saved passage records. Matching is by exact candidate symbol, explicitly not an independently verified ISIN identity. Only supported text extractions with known publication, observation and archive-save times at or before the snapshot cutoff qualify. Unknown/future/out-of-order timing, unsupported extraction, duplicate document hashes and sample limits are explicit exclusions. Missing candidate symbols and archive outage are distinct states. Returned records are deep-copied into the existing immutable hashed report and JSON export; old proposals are not recomputed or rewritten. No archive passage is promoted to a verified fact or used to relax allocation gates.

The saved-proposal view now displays its captured archive passages and exclusions. The read-only archive call adds no PDF download during proposal creation. Build/lint passed, 249 tests and ten database checks passed, covering timestamp ordering, unchanged copied observations, duplicate/size/count limits, outage semantics and API report integration. Production save/rendering remains unverified pending the existing portfolio and report-evidence migrations/deployment. No production release or Android rebuild occurred.

## Comparable reported YoY financial changes

Candidate financial assessments now preserve computed YoY comparisons inside their immutable portfolio report. Inputs must be issuer-reported numeric values for the same metric, scope, currency and exactly corresponding prior-year start/end dates within the same filing. The latest reported end date is assessed; different durations remain separate. Duplicate contexts/facts, missing prior periods, unavailable currencies and non-positive prior values yield explicit unavailable statuses. There is no cross-filing revision selection or leap-date adjustment. Up to 24 metric comparisons are retained with omission counts, source document IDs, reporting context IDs, values and formula.

The candidate UI displays revenue, continuing-profit and total-period-profit changes, inputs and missing-data reasons. These are historical accounting changes, not organic-growth attribution, diluted EPS growth, investment quality or an estimate of sustainable 25% growth. Corporate transactions and accounting comparability still require source review. No threshold changes allocation eligibility, and older proposals are not recomputed. The current rolling financial sample may contain no corresponding prior periods; the implementation must show unavailable rather than invent growth.

Local build/lint, 255 tests and ten database checks passed, covering period/scope/currency mismatches, zero/loss bases, missing/ambiguous facts, bounded output and server-rendered candidate comparisons. Successful production growth examples and browser rendering against saved production proposals remain unverified. No production release, migration or APK rebuild occurred.

## SuperAI Magic Trend external evaluation

The user's continuation is treated as proceeding with TFU_Tradewise's SuperAI Magic Trend Indicator: https://www.tradingview.com/script/C17O8SU8-SuperAI-Magic-Trend-Indicator/ . Its public page identifies it as protected/closed-source and usable on TradingView. Author descriptions are not independent performance evidence; no formula, repainting guarantee, usable alert contract or backend API has been verified.

Added a clearly external review panel to the portfolio workspace and each candidate, linking the publication and encoded NSE daily/weekly charts. Chart links do not install or calculate the script. Empty/invalid symbols do not produce links. No generated SuperAI values, scores, probabilities, alerts or trades were added. The panel lists required instrument/timeframe/settings/version/observation metadata and warns that retrospective exports cannot prove live signal availability.

Official TradingView documentation confirms generic CSV chart/indicator export (https://www.tradingview.com/support/solutions/43000537255-how-to-export-chart-data/) and webhook alert delivery with 2FA (https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/). These do not prove this specific script exposes useful numeric plots or alerts, or that the user's plan supports the required workflow. No subscription purchase, webhook setup, protected-source extraction or simulated clone was performed.

Validation: local browser panel and INFY chart-link generation verified; build/lint, 257 tests and ten database checks passed. Not deployed. Next input required is a real export plus its settings/column definitions, or a documented author-supported signal interface. Evaluate SCRAP alone versus SCRAP plus confirmed indicator observations and a simple trend baseline, with costs, drawdown and out-of-sample/forward checks. Never infer live non-repainting behaviour from a historical chart alone.

### Local indicator CSV inspection — 2026-10-04

Added a browser-local inspector under the top-level external indicator review panel. It reports record count, column names, numeric/blank/text counts and numeric ranges without mapping plots to signals or changing portfolio decisions. No upload or persistence occurs. Files are bounded to 5 MB, 50,000 data records and 200 columns; malformed quoting, duplicate/blank headers and inconsistent record widths fail explicitly. Zero remains numeric, missing cells remain missing, and formula-like contents remain text.

Validation: build and lint completed (existing external-indicator Fast Refresh warning remains); 263 tests and 10 database checks passed. Parser fixtures are synthetic and provide no performance evidence. No actual SuperAI export was supplied. Symbol/timeframe/settings validation, timestamp mapping, signal semantics, repainting observation and a costs-adjusted historical/forward comparison remain pending. This phase is local only, not a deployment or Android release.

### Explicit CSV timestamp checks — 2026-10-04

The local CSV inspector now retains parsed records in browser memory for explicit time-column selection. Users choose ISO timestamps with a timezone offset, Unix seconds or Unix milliseconds. The checker rejects timezone-free/date-only values, impossible calendar dates, non-integer Unix values and overflow. It reports blanks, invalid records, repeated instants (including equivalent offsets), backwards steps between valid records, and earliest/latest UTC timestamps. It never sorts, drops or repairs rows. Format selection is an assertion by the user, not proof of the original export's unit or candle semantics.

This does not verify trading-session coverage, gaps, publication/observation times, repainting or performance. No external export has been supplied. Validation: build and lint completed with the existing Fast Refresh warning; 267 tests and 10 database checks passed. New fixtures are explicitly synthetic parser tests. Timestamp-result UI has not been visually exercised with an actual export. No production deployment, database migration or Android rebuild was performed in this phase.

### Browser verification of timestamp inspector — 2026-10-04

Exercised local file selection and time-column/format controls in the running app using a clearly labelled synthetic five-record fixture (not market data). Observed exactly 3 valid, 1 blank, 1 invalid, 1 repeated instant and 1 backwards step; equivalent +05:30/Z instants normalized correctly. Switching from ISO to Unix seconds showed 0 valid, 1 blank, 4 invalid and unavailable date bounds. The mobile-width view kept the controls, counts and qualification text readable. Reloaded the app to clear synthetic data from memory after testing. Evidence screenshot: `tmp/pdfs/indicator-time-test.png` in the Codex workspace. No real export, performance evaluation, deployment or APK build occurred. No code correction was needed; earlier automated test results were not rerun for this documentation-only update.

### Issuer audit declarations in financial evidence — 2026-10-04

Verified two fields in the official NSE filing https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1732506_01102026081903_WEB.xml : `WhetherResultsAreAuditedOrUnaudited` and `DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification`. The financial parser now preserves these declarations with field names, context, period, reporting scope and explicit missing/duplicate/unsupported/context-failure states. A declaration must use the validated issuer context; no text classification, clean-governance inference or allocation approval occurs. Unsupported/nil/oversized text remains unavailable. In particular, “Not applicable” is not treated as an unmodified audit opinion.

The disclosure preview and each saved candidate's captured financial documents display the shared audit-declaration panel. Older observations show that declarations were not captured. Existing document URLs, publication/observation timestamps and hashes preserve source provenance. No new source lookup is added during rendering and no old proposal is recomputed.

Real-source validation: PRANAV consolidated filing for 2026-04-01 through 2026-06-30 returned “Unaudited” and “Not applicable” from context OneD. This is evidence of extraction only, not company quality. Build/lint completed (existing external-indicator Fast Refresh warning remains); 271 tests and ten database checks passed. Regression cases cover missing/duplicate/nil/oversized declarations, mismatched context, source text escaping and old observations. Browser rendering of the new panel, production persistence/deployment and Android remain unverified. Full signed-auditor-report review, qualifications/key matters, audit fees and governance assessment remain future phases.
