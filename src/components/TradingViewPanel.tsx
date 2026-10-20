import { useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';

// TradingView's free embeddable widgets (https://www.tradingview.com/widget-docs/), used as published: the
// embed script draws an iframe with data TradingView licenses for widgets. TradingView offers no data API, and
// NSE is not among its widget markets; for India it shows BSE end-of-day data. So the panels use the BSE
// listing and say so, and the live NSE chart opens on TradingView itself.
type Widget = 'advanced-chart' | 'technical-analysis' | 'financials' | 'symbol-profile';
const INDICES: Record<string, string> = { NIFTY: 'NSE:NIFTY', BANKNIFTY: 'NSE:BANKNIFTY' };
// TradingView writes '&' and '-' in tickers as '_' (M&M → M_M).
const bseTicker = (symbol: string) => 'BSE:' + symbol.replace(/[&-]/g, '_');
const nseChartUrl = (symbol: string) => 'https://in.tradingview.com/chart/?symbol=' + encodeURIComponent(INDICES[symbol] ?? 'NSE:' + symbol.replace(/[&-]/g, '_'));

function TradingViewWidget({ widget, config, height }: { widget: Widget; config: Record<string, unknown>; height: number }) {
 const host = useRef<HTMLDivElement>(null), json = JSON.stringify(config);
 useEffect(() => {
  const el = host.current; if (!el) return;
  el.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';
  const s = document.createElement('script');
  s.type = 'text/javascript'; s.async = true; s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`; s.textContent = json;
  el.appendChild(s);
  return () => { el.innerHTML = ''; };
 }, [widget, json]);
 // As in TradingView's own examples, the fixed height sits on a wrapper; the widget fills it.
 return <div className="tv-frame" style={{ height }}><div ref={host} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }} /></div>;
}

export function TradingViewPanel({ symbol, isIndex }: { symbol: string; isIndex: boolean }) {
 const ticker = bseTicker(symbol), base = { symbol: ticker, locale: 'en', colorTheme: 'light', isTransparent: true, width: '100%', height: '100%' };
 const open = <a className="btn btn-secondary" href={nseChartUrl(symbol)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Open NSE chart on TradingView</a>;
 if (isIndex) return <div className="grid gap-3"><p className="notice">TradingView does not show NSE indices in embedded widgets. Open the live {symbol} chart on TradingView instead.</p><div>{open}</div></div>;
 return <div className="grid gap-4">
  <div className="data-card-head"><p className="caption" style={{ maxWidth: 760 }}>Chart, technical rating, company profile and financials by TradingView. Embedded widgets show the <strong>BSE</strong> listing ({ticker}) with <strong>end-of-day</strong> data, because TradingView does not offer NSE in widgets; the full live NSE chart opens on TradingView. TradingView's ratings are its own indicator summary, not one of our validated rules.</p>{open}</div>
  <section className="card tv-card"><TradingViewWidget widget="advanced-chart" height={520} config={{ autosize: true, symbol: ticker, interval: 'D', timezone: 'Asia/Kolkata', theme: 'light', style: '1', locale: 'en', allow_symbol_change: false, hide_side_toolbar: false, support_host: 'https://www.tradingview.com' }} /></section>
  <div className="grid lg:grid-cols-2 gap-4">
   <section className="card tv-card"><TradingViewWidget widget="technical-analysis" height={430} config={{ ...base, interval: '1D', showIntervalTabs: true, displayMode: 'single' }} /></section>
   <section className="card tv-card"><TradingViewWidget widget="symbol-profile" height={430} config={base} /></section>
  </div>
  <section className="card tv-card"><TradingViewWidget widget="financials" height={520} config={{ ...base, displayMode: 'regular' }} /></section>
 </div>;
}
