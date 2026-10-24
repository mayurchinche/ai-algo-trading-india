// node --env-file=.env.worker research/data/probeFyers.mjs — needs FYERS_APP_ID (e.g. ABC123-100) and FYERS_ACCESS_TOKEN (daily). Probes expired-option 1-minute history.
const A=process.env.FYERS_APP_ID,T=process.env.FYERS_ACCESS_TOKEN;if(!A||!T){console.error('FYERS_APP_ID / FYERS_ACCESS_TOKEN missing in .env.worker');process.exit(1);}
const H={Authorization:`${A}:${T}`},get=async u=>{const r=await fetch('https://api-t1.fyers.in'+u,{headers:H});return r.json();};
const sym=process.argv[2]||'NSE:NIFTY2610622600CE',now=Math.floor(Date.now()/86400000);
for(const days of [3,30,90,365]){const j=await get(`/data/history?symbol=${encodeURIComponent(sym)}&resolution=1&date_format=0&range_from=${(now-days)*86400}&range_to=${now*86400}&cont_flag=1`);console.log(sym,days+'d',j.s,j.candles?.length??j.message);}
