import { useEffect, useMemo, useState } from 'react';
import { QUESTIONS, assessRiskProfile, type QuestionId, type RiskAssessment } from '../../shared/riskProfile';
import { importHoldingsCsv, importHoldingsSheet, HEADER_ALIASES, type HoldingsImport } from '../../shared/holdingsImport';
import { assessPortfolioFit, type PortfolioFit } from '../../shared/portfolioFit';
import { buildReference, priceHoldings, loadRiskAnswers, RISK_ANSWERS_KEY } from '../services/portfolioFit';
import { fetchScorecards, readable } from '../services/scorecards';

const MAX_XLSX_BYTES = 5_000_000;
const rupees = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const pct = (n: number | null) => n === null ? '—' : n.toFixed(1) + '%';

export function RiskProfileResult({ result }: { result: RiskAssessment }) {
 if (result.status !== 'ASSESSED') return <p className="text-sm text-[var(--text-muted)]">Answer all {QUESTIONS.length} questions to see your limits.</p>;
 const l = result.limits, q = (id: string) => QUESTIONS.find(x => x.id === id)?.question.toLowerCase() ?? id;
 return <div className="space-y-2"><p><strong>{result.label}</strong> — set by your answer on {result.limitedBy.map(q).join(' and ')}.</p>
  <p className="text-sm">Limits: at most {l.maxStockPct}% in one stock, {l.maxTopFivePct}% in the top five and {l.maxSectorPct}% in one sector; at least {l.minHoldings} holdings. Research-portfolio defaults: {l.cashReservePct}% cash reserve, {l.riskBudgetPct}% total stop-loss budget, up to {l.maxPositions} positions.</p>
  {result.tensions.map(t => <p key={t.question} className="text-sm">Your answer “{t.answer}” suggests more risk capacity, but the profile follows your most cautious answer.</p>)}
  <p className="text-xs">{result.note}</p></div>;
}

export function FitReport({ fit }: { fit: PortfolioFit }) {
 const badge = { PASS: 'badge-green', BREACH: 'badge-red', UNKNOWN: 'badge-amber' } as const;
 return <div className="space-y-4">
  <p><strong>{fit.status === 'WITHIN_LIMITS' ? 'Within your limits' : fit.status === 'OUTSIDE_LIMITS' ? 'Outside your limits' : 'Incomplete: some checks could not be made'}</strong>{fit.totals.marketValue !== null ? ` · market value ${rupees(fit.totals.marketValue)}` : ''}{fit.totals.costValue !== null ? ` · cost ${rupees(fit.totals.costValue)}` : ''}</p>
  <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Check</th><th className="text-right">Yours</th><th className="text-right">Limit</th><th className="text-center">Result</th></tr></thead><tbody>{fit.checks.map(c => <tr key={c.id}>
   <td>{c.label}{c.holding ? ` (${c.holding})` : ''}{c.sector ? ` (${c.sector})` : ''}</td>
   <td className="text-right font-mono">{c.value === null ? '—' : c.unit === '%' ? pct(c.value) : c.value}</td>
   <td className="text-right font-mono">{c.unit === '%' ? '≤ ' + c.limit + '%' : '≥ ' + c.limit}</td>
   <td className="text-center"><span className={`badge ${badge[c.status]}`} title={c.reason ? readable(c.reason) : undefined}>{c.status.toLowerCase()}</span></td>
  </tr>)}</tbody></table></div>
  {!!fit.unpriced.length && <p className="text-sm">No usable price for {fit.unpriced.join(', ')}, so weight checks are unknown.</p>}
  {fit.checks.some(c => c.reason === 'UNCLASSIFIED_HOLDINGS') && <p className="text-sm">Sector check is unknown: unclassified holdings ({pct(fit.checks.find(c => c.id === 'largestSector')!.unclassifiedPct ?? null)}) could belong to the largest sector.</p>}
  <p className="text-sm">Quality coverage: {pct(fit.quality.supportedFilingPct)} of value has a supported annual filing; Value score covers {pct(fit.quality.valueScoreCoveragePct)}{fit.quality.weightedValueScore !== null ? `, weighted average ${Math.round(fit.quality.weightedValueScore)}` : ''}.</p>
  <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Holding</th><th>Sector</th><th className="text-right">Qty</th><th className="text-right">Close</th><th className="text-right">Value</th><th className="text-right">Weight</th></tr></thead><tbody>{fit.positions.map(p => <tr key={p.symbol ?? p.isin ?? ''}>
   <td className="font-semibold">{p.symbol ?? p.isin}</td><td>{p.industry ?? <span className="text-[var(--text-muted)]">Unclassified</span>}</td><td className="text-right font-mono">{p.quantity.toLocaleString('en-IN')}</td>
   <td className="text-right font-mono" title={'date' in p.price && p.price.date ? 'Close of ' + p.price.date : undefined}>{p.price.status === 'OBSERVED' && 'close' in p.price ? p.price.close.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : readable(p.price.status)}</td>
   <td className="text-right font-mono">{p.value === null ? '—' : rupees(p.value)}</td><td className="text-right font-mono">{pct(p.weightPct)}</td>
  </tr>)}</tbody></table></div>
  <ul className="text-xs list-disc pl-5">{fit.limitations.map(l => <li key={l}>{l}</li>)}</ul>
 </div>;
}

export function PortfolioFitPage() {
 const [answers, setAnswers] = useState<Partial<Record<QuestionId, number>>>(loadRiskAnswers);
 const [imported, setImported] = useState<HoldingsImport | null>(null);
 const [importError, setImportError] = useState('');
 const [fit, setFit] = useState<PortfolioFit | null>(null);
 const [checking, setChecking] = useState(false);
 const result = useMemo(() => { try { return assessRiskProfile(answers); } catch { return assessRiskProfile({}); } }, [answers]);
 useEffect(() => { try { localStorage.setItem(RISK_ANSWERS_KEY, JSON.stringify(answers)); } catch { /* storage unavailable */ } }, [answers]);
 async function readFile(file: File) {
  setFit(null); setImportError(''); setImported(null);
  try {
   // Excel workbooks are read in the browser (first sheet only); the file is never uploaded.
   if (/\.xlsx$/i.test(file.name)) {
    if (file.size > MAX_XLSX_BYTES) throw new Error('Excel file is larger than 5 MB');
    const { readSheet } = await import('read-excel-file/browser');
    setImported(importHoldingsSheet(await readSheet(file)));
   } else setImported(importHoldingsCsv(await file.text()));
  } catch (e) { setImportError(e instanceof Error ? e.message : 'File could not be read'); }
 }
 useEffect(() => {
  if (!imported || result.status !== 'ASSESSED' || !imported.holdings.length) { setFit(null); return; }
  let active = true; setChecking(true);
  (async () => {
   const scorecards = await fetchScorecards('NIFTY50').catch(() => null), reference = buildReference(scorecards);
   const prices = await priceHoldings(imported.holdings, reference);
   if (active) setFit(assessPortfolioFit({ holdings: imported.holdings, prices, reference, limits: result.limits }));
  })().finally(() => { if (active) setChecking(false); });
  return () => { active = false; };
 }, [imported, result]);
 return <div className="space-y-6">
  <div className="page-title"><div><h2>Risk profile and portfolio fit</h2><p>Set concentration limits from a short self-assessment, then check a holdings file against them. Your answers stay in this browser; the holdings file is read in the browser and not uploaded or saved.</p></div></div>
  <section className="card space-y-4"><h3>Your risk profile</h3>
   {QUESTIONS.map(q => <fieldset key={q.id} className="space-y-1"><legend className="font-semibold">{q.question}</legend>{q.options.map((o, i) => <label key={o} className="flex gap-2 items-center text-sm"><input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers(a => ({ ...a, [q.id]: i }))} />{o}</label>)}</fieldset>)}
   <RiskProfileResult result={result} />
  </section>
  <section className="card space-y-3"><h3>Holdings file</h3>
   <p className="text-sm">CSV with a header row: quantity plus symbol or ISIN; average cost is optional. Recognised column names: {Object.entries(HEADER_ALIASES).map(([f, a]) => `${f} (${a.join(', ')})`).join('; ')}. Excel .xlsx files are read from the first sheet; account details above the header row are skipped.</p>
   <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f); }} />
   {importError && <p role="alert" className="notice">{importError}</p>}
   {imported && <p className="text-sm">{imported.coverage.imported} holdings from {imported.coverage.rows} rows below the header on line {imported.headerLine}{imported.coverage.mergedRows ? `, ${imported.coverage.mergedRows} repeated rows merged` : ''}{imported.skipped.length ? `; skipped ${imported.skipped.map(s => `line ${s.line} (${readable(s.reason)})`).join(', ')}` : ''}{imported.ignoredColumns.length ? `; ignored columns: ${imported.ignoredColumns.join(', ')}` : ''}.</p>}
  </section>
  {checking && <p className="text-sm" role="status">Checking prices…</p>}
  {fit && <section className="card"><FitReport fit={fit} /></section>}
 </div>;
}
