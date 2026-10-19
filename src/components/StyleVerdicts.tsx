import type { StyleVerdict, VerdictItem } from '../services/stockAnalysis';

const FIT: Record<StyleVerdict['fit'], [string, string]> = {
 STRONG_FIT: ['Strong fit', 'text-[var(--green)]'], PARTIAL_FIT: ['Partial fit', ''], WEAK_FIT: ['Weak fit', 'text-[var(--red)]'], NOT_SCORED: ['Not scored', 'opacity-70'],
};
const top = (c: VerdictItem) => `${c.label} · top ${Math.max(1, Math.round(100 - c.percentile))}%`;
const bottom = (c: VerdictItem) => `${c.label} · bottom ${Math.max(1, Math.round(c.percentile))}%`;

// Per-style plus/minus points from peer percentiles (plus ≥ 70th, minus ≤ 30th). Our own rules; not advice.
export function StyleVerdicts({ verdicts }: { verdicts: StyleVerdict[] }) {
 if (!verdicts.length) return null;
 return <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
  {verdicts.map(v => <div key={v.id} className="card space-y-1 text-sm">
   <div className="flex justify-between gap-2"><strong>{v.label}</strong><span className={FIT[v.fit][1]}>{FIT[v.fit][0]}{v.score === null ? '' : ` · ${Math.round(v.score)}`}</span></div>
   {v.plus.map(c => <div key={c.metric} className="text-[var(--green)]">+ {top(c)}</div>)}
   {v.minus.map(c => <div key={c.metric} className="text-[var(--red)]">− {bottom(c)}</div>)}
   {!v.plus.length && !v.minus.length && v.fit !== 'NOT_SCORED' && <div className="opacity-70">No criterion in the top or bottom 30% of peers</div>}
   {!!v.unavailable.length && <div className="opacity-70">Not ranked: {v.unavailable.map(u => u.label).join(', ')}</div>}
  </div>)}
 </div>;
}
