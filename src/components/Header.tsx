import { useState, useEffect } from 'react';
import { type LucideIcon, Gauge, Activity, LineChart, Radar, BookOpen, Building2, Gem, ShieldCheck, ArrowUpRight, TrendingUp, ClipboardList, ListFilter, Scale, ShoppingBasket, Wand2, Blocks, Newspaper, Sunrise, Briefcase, ArrowUpDown, Bell, Compass, Sparkles, MessageSquareText, Layers, Target } from 'lucide-react';
import type { LiveStock } from '../services/liveData';
import { formatIST } from '../services/tradingTime';
import { fetchMarketStatus } from '../services/marketStatus';
interface HeaderProps {activeTab:string;onTabChange:(tab:string)=>void;nifty:LiveStock|null;lastUpdated:Date|null}
const sections: {label:string;items:[string,string,LucideIcon][]}[]=[
 {label:'TRADE',items:[['Today','Today',Gauge],['Analysis','Stock analysis',LineChart],['Signals','Signals',Radar],['Alerts','Alerts',Bell],['Opening gaps','Opening gaps',ArrowUpDown],['Paper trading','Paper trading',BookOpen],['Accuracy','Accuracy',Target],['IPO','IPO analysis',Building2]]},
 {label:'IDEAS',items:[['Discover','Discover',Compass],['Watch ideas','Watch ideas',Sparkles]]},
 {label:'INVESTING',items:[['Stacks','Stacks',Layers],['Assistant','Assistant',MessageSquareText],['Scorecards','Scorecards',ClipboardList],['Screener','Screener',ListFilter],['Trend','Trend score',TrendingUp],['Baskets','Baskets',ShoppingBasket],['Portfolio fit','Portfolio fit',Scale]]},
 {label:'STRATEGY TOOLS',items:[['Rule builder','Strategy lab',Blocks],['Options wizard','Options wizard',Wand2]]},
 {label:'MORE',items:[['Market News','Market news',Newspaper],['Pre-market','Pre-market',Sunrise],['Portfolios','Portfolios',Briefcase],['Metals','Metals',Gem]]},
];
export function Header({activeTab,onTabChange,nifty}:HeaderProps){
 const [market,setMarket]=useState({isOpen:false,status:'Checking market'});
 useEffect(()=>{let active=true;const update=()=>void fetchMarketStatus().then(s=>{if(active)setMarket(s);}).catch(()=>{if(active)setMarket({isOpen:false,status:'Unavailable'});});update();const timer=setInterval(update,60000);return()=>{active=false;clearInterval(timer);};},[]);
 return <><aside className="workspace-sidebar"><a className="brand" href="#main-content" aria-label="AlgoTrader workspace"><span className="brand-mark"><Activity size={22}/></span><span>AlgoTrader<span className="brand-caption">INDIA · PAPER TRADING</span></span></a>
 <div className="mode-label"><span className="status-dot"/>Simulation workspace</div>
 <nav aria-label="Workspace navigation">{sections.map(group=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([id,label,Icon])=><button key={id} aria-current={activeTab===id?'page':undefined} onClick={()=>onTabChange(id)}><Icon size={18}/><span>{label}</span>{activeTab===id&&<span className="nav-active-mark"/>}</button>)}</div>)}</nav>
 <div className="sidebar-note"><ShieldCheck size={20}/><strong>Practice with perspective.</strong><p>Virtual capital. Recorded decisions. A clearer view of your process.</p><span>No real broker orders</span></div></aside>
 <header className="workspace-header"><div className="mobile-brand"><span className="brand-mark"><Activity size={20}/></span><strong>AlgoTrader</strong></div><div className="workspace-breadcrumb">Workspace <span>/</span> <strong>{sections.flatMap(g=>g.items).find(i=>i[0]===activeTab)?.[1]}</strong></div><div className="header-actions"><span className={`market-state ${market.isOpen?'is-open':''}`}><span className="status-dot"/>{market.isOpen?'Market open':market.status==='Unavailable'?'Status unavailable':market.status==='Checking market'?'Checking market':/close/i.test(market.status)?'Market closed':market.status}</span><button className="icon-button" onClick={()=>onTabChange('Signals')} aria-label="Open signals"><Radar size={19}/></button></div></header>
 <nav className="mobile-research-nav" aria-label="All features">{sections.flatMap(g=>g.items).map(([id,label])=><button key={id} aria-current={activeTab===id?'page':undefined} onClick={()=>onTabChange(id)}>{label}</button>)}</nav>
 <div className="market-strip"><span className="market-strip-label">MARKET SNAPSHOT</span>{nifty?<><strong>NIFTY 50</strong><span className="market-price">{nifty.ltp.toLocaleString('en-IN',{maximumFractionDigits:2})}</span><span className={nifty.changePct>=0?'positive':'negative'}>{nifty.changePct>=0?'+':''}{nifty.changePct.toFixed(2)}%</span><time>{formatIST(nifty.quoteTime)}</time></>:<span>Waiting for a verified market observation</span>}<span className="strip-note"><ArrowUpRight size={14}/>Provider observations</span></div></>;
}
