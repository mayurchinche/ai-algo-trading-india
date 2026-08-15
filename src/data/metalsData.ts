export interface Metal {
  name: string;
  symbol: string;
  icon: string;
  pricePerGram: number;
  pricePerOz: number;
  change24h: number;
  change24hPct: number;
  change7d: number;
  change30d: number;
  change1y: number;
  high52w: number;
  low52w: number;
  signal: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
  trend: 'Uptrend' | 'Downtrend' | 'Sideways';
  rsi: number;
  support: number;
  resistance: number;
  aiScore: number;
  outlook: string;
  reasons: string[];
  investmentThesis: string;
  bestForm: string;
}

export const metals: Metal[] = [
  {
    name: 'Gold', symbol: 'XAU', icon: '🥇',
    pricePerGram: 15513, pricePerOz: 482500,
    change24h: 182, change24hPct: 1.19, change7d: 2.8, change30d: 7.2, change1y: 26.4,
    high52w: 15980, low52w: 12280,
    signal: 'STRONG BUY', trend: 'Uptrend', rsi: 64.2, support: 15100, resistance: 15800,
    aiScore: 92,
    outlook: 'Gold is in a secular bull market. Central bank buying at record levels (1,136 tonnes in 2025). India\'s gold demand up 18% YoY driven by weddings and investment. US rate cuts ahead = tailwind.',
    reasons: [
      'Central banks bought record 1,136 tonnes in 2025 — diversifying away from USD',
      'US Fed expected to cut rates 3x in 2026 — lower rates boost gold',
      'Geopolitical tensions (Middle East, Taiwan) driving safe-haven demand',
      'India wedding season Aug-Dec = seasonal demand surge of 200+ tonnes',
      'Gold ETF inflows: ₹4,200 Cr in last 3 months — highest since COVID',
      'Rupee depreciation (₹86/USD) makes gold a natural inflation hedge'
    ],
    investmentThesis: 'Allocate 10-15% of portfolio. Buy on dips near ₹15,000-15,200/g. Target ₹17,500/g in 12 months.',
    bestForm: 'Sovereign Gold Bonds (SGB) > Gold ETFs > Digital Gold > Physical'
  },
  {
    name: 'Silver', symbol: 'XAG', icon: '🥈',
    pricePerGram: 250, pricePerOz: 7776,
    change24h: 5.80, change24hPct: 2.37, change7d: 4.6, change30d: 11.2, change1y: 38.5,
    high52w: 268, low52w: 180,
    signal: 'STRONG BUY', trend: 'Uptrend', rsi: 68.7, support: 240, resistance: 262,
    aiScore: 88,
    outlook: 'Silver is massively undervalued vs gold (Gold:Silver ratio at 78, historical avg 60). Industrial demand from solar panels + EVs growing 15% annually. Supply deficit widening for 4th consecutive year.',
    reasons: [
      'Gold:Silver ratio at 78x — reversion to 60x mean implies 30% upside for silver',
      'Solar panel demand: 180M oz in 2026 (up 20% YoY) — structural industrial demand',
      'EV revolution: each EV uses 1oz silver vs 0.5oz for ICE vehicles',
      'Mine supply flat — 4th year of structural deficit (150M oz gap)',
      'Silver ETF holdings at 5-year highs — institutional accumulation phase',
      'India silver imports up 35% YoY — festive + industrial demand'
    ],
    investmentThesis: 'Silver offers higher beta than gold. Best risk-reward in precious metals. Buy at ₹240-245/g, target ₹320/g in 12 months.',
    bestForm: 'Silver ETFs > Physical bars (1kg) > Digital Silver'
  },
  {
    name: 'Platinum', symbol: 'XPT', icon: '💎',
    pricePerGram: 8450, pricePerOz: 262800,
    change24h: -48, change24hPct: -0.57, change7d: 1.8, change30d: 5.2, change1y: 15.4,
    high52w: 9120, low52w: 7320,
    signal: 'BUY', trend: 'Uptrend', rsi: 55.3, support: 8200, resistance: 8800,
    aiScore: 74,
    outlook: 'Platinum is trading at a historic discount to gold (60% below). Hydrogen economy catalyst: each fuel cell vehicle needs 30-60g of platinum. Auto catalyst demand recovering as emission norms tighten globally.',
    reasons: [
      'Trading 60% below gold price — largest discount in history',
      'Hydrogen fuel cells: each vehicle uses 30-60g platinum — future demand driver',
      'Auto catalyst demand: Euro 7 and BS-VII emission norms require more platinum',
      'Supply concentrated in South Africa (70%) — geopolitical risk premium building',
      'Investment demand: platinum ETF inflows turned positive after 2 years',
      'Jewelry demand in Japan and China recovering post-COVID'
    ],
    investmentThesis: 'Contrarian play on hydrogen economy. Small allocation (3-5%). Buy at ₹8,200-8,400/g. Target ₹10,500/g in 18 months.',
    bestForm: 'Physical coins > International ETFs (no India platinum ETF yet)'
  },
  {
    name: 'Palladium', symbol: 'XPD', icon: '⚪',
    pricePerGram: 8920, pricePerOz: 277400,
    change24h: -102, change24hPct: -1.13, change7d: -2.4, change30d: -4.8, change1y: -18.2,
    high52w: 11850, low52w: 8540,
    signal: 'SELL', trend: 'Downtrend', rsi: 38.4, support: 8600, resistance: 9400,
    aiScore: 28,
    outlook: 'Palladium faces structural headwinds. EV adoption reduces auto catalyst demand (its primary use). Substitution with cheaper platinum accelerating. Russia supply normalization removed risk premium.',
    reasons: [
      'EV adoption reducing gasoline car production — palladium\'s primary demand source',
      'Automakers substituting palladium with cheaper platinum in catalytic converters',
      'Russia (40% of supply) exports normalized — no supply disruption premium',
      'Recycling supply increasing as older vehicles are scrapped',
      'Investment demand negative — ETF outflows for 8 consecutive months',
      'Technical breakdown below 200-day SMA — bears in control'
    ],
    investmentThesis: 'Avoid or short. Structural decline story. EV transition is a permanent headwind. No allocation recommended.',
    bestForm: 'N/A — Not recommended for investment'
  },
  {
    name: 'Copper', symbol: 'HG', icon: '🟤',
    pricePerGram: 78.50, pricePerOz: 2442,
    change24h: 0.95, change24hPct: 1.23, change7d: 2.8, change30d: 6.4, change1y: 22.1,
    high52w: 84.60, low52w: 64.20,
    signal: 'BUY', trend: 'Uptrend', rsi: 62.1, support: 75, resistance: 82,
    aiScore: 79,
    outlook: 'Copper is the "new oil" of the energy transition. EVs use 4x more copper than ICE vehicles. Data centers for AI need massive copper wiring. Supply growth minimal — new mines take 15 years to develop.',
    reasons: [
      'Each EV uses 83kg copper vs 23kg for ICE — 4x structural demand growth',
      'AI data centers: single large facility needs 30,000+ tonnes of copper',
      'Global supply deficit expected to reach 10M tonnes by 2030',
      'India\'s infrastructure push: ₹10L Cr capex = massive copper demand',
      'Green energy: solar, wind, grid storage all copper-intensive',
      'Chile and Peru (50% of supply) facing water shortages — production constraints'
    ],
    investmentThesis: 'Best industrial metal play on energy transition. Invest via Hindalco, Hindustan Copper stocks or MCX futures. Buy at ₹75-77/g. Target 20% upside in 12 months.',
    bestForm: 'Hindalco/Hindustan Copper stocks > MCX Copper futures > Physical'
  },
];

export const metalsPriceHistory = {
  gold: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 6, 16 + i).toISOString().slice(5, 10),
    price: Math.round((14400 + i * 38 + Math.sin(i * 0.4) * 180 + (Math.random() - 0.3) * 80) * 100) / 100,
  })),
  silver: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 6, 16 + i).toISOString().slice(5, 10),
    price: Math.round((222 + i * 1.0 + Math.sin(i * 0.35) * 5 + (Math.random() - 0.3) * 3) * 100) / 100,
  })),
};

export const sectorAllocation = [
  { metal: 'Gold', allocation: '10-15%', risk: 'Low', horizon: '1-5 years', bestFor: 'Inflation hedge, portfolio insurance' },
  { metal: 'Silver', allocation: '5-8%', risk: 'Medium', horizon: '1-3 years', bestFor: 'Higher beta gold proxy + industrial growth' },
  { metal: 'Platinum', allocation: '2-4%', risk: 'Medium-High', horizon: '2-5 years', bestFor: 'Hydrogen economy bet, contrarian value' },
  { metal: 'Copper', allocation: '3-5%', risk: 'Medium', horizon: '1-3 years', bestFor: 'Energy transition, India infra play' },
  { metal: 'Palladium', allocation: '0%', risk: 'High', horizon: 'N/A', bestFor: 'Avoid — structural decline' },
];
