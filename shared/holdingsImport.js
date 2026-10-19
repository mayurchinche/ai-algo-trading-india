// Holdings import from CSV or spreadsheet rows. Broker exports differ, so only listed header names are recognised;
// nothing is guessed from column positions. The header is the first row (within the first HEADER_SCAN_ROWS) that
// names a quantity and a symbol or ISIN column, because exports often start with account details. Every skipped
// row is reported with its line (row) number and reason.
export const MAX_CSV_BYTES=1_000_000,MAX_ROWS=2000,HEADER_SCAN_ROWS=20;
const norm=h=>h.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
export const HEADER_ALIASES=Object.freeze({
 symbol:['symbol','instrument','tradingsymbol','scrip','stock','stocksymbol','scripname'],
 isin:['isin','isincode'],
 quantity:['qty','quantity','quantityavailable','totalquantity','holdingquantity','shares','netqty'],
 averagePrice:['avgcost','averagecost','avgprice','averageprice','buyaverage','buyavg','avgbuyprice'],
});
const fieldOf=header=>Object.keys(HEADER_ALIASES).find(f=>HEADER_ALIASES[f].includes(norm(header)))??null;

// RFC 4180: quoted fields may contain commas, quotes ("") and line breaks.
export function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false,i=0,line=1,rowLine=1;
 if(text.charCodeAt(0)===0xfeff)i=1;
 for(;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else{if(ch==='\n')line++;field+=ch;}continue;}
  if(ch==='"'&&field==='')quoted=true;
  else if(ch===','){row.push(field);field='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push({line:rowLine,cells:row});row=[];field='';line++;rowLine=line;}
  else field+=ch;
 }
 if(quoted)throw new Error(`Unterminated quoted field starting on line ${rowLine}`);
 if(field!==''||row.length){row.push(field);rows.push({line:rowLine,cells:row});}
 return rows.filter(r=>r.cells.some(c=>c.trim()!==''));
}
const number=v=>{const t=String(v).trim().replace(/,/g,'');return /^-?\d+(\.\d+)?$/.test(t)?Number(t):NaN;};
const symbolOf=v=>{const t=String(v).trim().toUpperCase().replace(/^(NSE|BSE):/,'');return /^[A-Z0-9&-]{1,30}$/.test(t)?t:null;};

export function importHoldingsCsv(text){
 if(typeof text!=='string')throw new TypeError('CSV text required');
 if(new TextEncoder().encode(text).length>MAX_CSV_BYTES)throw new Error('File is larger than 1 MB');
 return importHoldingsRows(parseCsv(text));
}
// Spreadsheet rows (arrays of cell values, first sheet row first). Numbers are read as written; dates and other
// non-text cells become text that fails the numeric and symbol checks rather than being converted.
export function importHoldingsSheet(sheet){
 if(!Array.isArray(sheet))throw new TypeError('Sheet rows required');
 const text=v=>v===null||v===undefined?'':typeof v==='number'?(Number.isFinite(v)?String(v):''):v instanceof Date?v.toISOString():String(v);
 return importHoldingsRows(sheet.map((cells,i)=>({line:i+1,cells:Array.isArray(cells)?cells.map(text):[]})).filter(r=>r.cells.some(c=>c.trim()!=='')));
}
// rows: [{line, cells: string[]}] with blank rows removed.
export function importHoldingsRows(rows){
 if(!rows.length)throw new Error('The file has no rows');
 const qualifies=cells=>{const f=cells.map(fieldOf);return f.includes('quantity')&&(f.includes('symbol')||f.includes('isin'));};
 const at=rows.slice(0,HEADER_SCAN_ROWS).findIndex(r=>qualifies(r.cells));
 if(at<0)throw new Error(`Need a header row (within the first ${HEADER_SCAN_ROWS} rows) with a quantity column and a symbol or ISIN column. Recognised names: `+Object.entries(HEADER_ALIASES).map(([f,a])=>f+' ('+a.join(', ')+')').join('; '));
 const header=rows[at].cells,fields=header.map(fieldOf),data=rows.slice(at+1);
 const column=f=>fields.indexOf(f),dup=Object.keys(HEADER_ALIASES).filter(f=>fields.filter(x=>x===f).length>1);
 if(dup.length)throw new Error('More than one column for: '+dup.join(', '));
 if(data.length>MAX_ROWS)throw new Error(`More than ${MAX_ROWS} rows`);
 const skipped=[],merged=new Map();
 for(const {line,cells} of data){
  const get=f=>column(f)<0?'':(cells[column(f)]??'').trim();
  const symbol=get('symbol')?symbolOf(get('symbol')):null,isinRaw=get('isin').toUpperCase(),isin=/^IN[A-Z0-9]{10}$/.test(isinRaw)?isinRaw:null;
  const quantity=number(get('quantity')),avg=get('averagePrice')===''?null:number(get('averagePrice'));
  let reason=null;
  if(get('symbol')&&!symbol)reason='INVALID_SYMBOL';else if(isinRaw&&!isin)reason='INVALID_ISIN';else if(!symbol&&!isin)reason='NO_SYMBOL_OR_ISIN';
  else if(!Number.isFinite(quantity)||quantity<=0)reason='INVALID_QUANTITY';else if(avg!==null&&(!Number.isFinite(avg)||avg<0))reason='INVALID_AVERAGE_PRICE';
  if(reason){skipped.push({line,reason});continue;}
  const key=isin??symbol,prior=merged.get(key);
  if(prior&&((prior.symbol&&symbol&&prior.symbol!==symbol)||(prior.isin&&isin&&prior.isin!==isin))){skipped.push({line,reason:'CONFLICTS_WITH_EARLIER_ROW'});continue;}
  // Repeated instruments (for example across demat accounts) are summed; average cost survives only if every row has one.
  if(prior){const q=prior.quantity+quantity;prior.averagePrice=prior.averagePrice!==null&&avg!==null?(prior.averagePrice*prior.quantity+avg*quantity)/q:null;prior.quantity=q;prior.lines.push(line);prior.symbol??=symbol;prior.isin??=isin;}
  else merged.set(key,{symbol,isin,quantity,averagePrice:avg,lines:[line]});
 }
 const holdings=[...merged.values()];
 return {holdings,skipped,headerLine:rows[at].line,coverage:{rows:data.length,imported:holdings.length,mergedRows:data.length-skipped.length-holdings.length,skipped:skipped.length},
  columns:Object.fromEntries(Object.keys(HEADER_ALIASES).map(f=>[f,column(f)<0?null:header[column(f)]])),ignoredColumns:header.filter((_,i)=>fields[i]===null)};
}
