import {useMemo,useRef,useState} from 'react';
import {inspectIndicatorCsv,MAX_INDICATOR_CSV_BYTES,type CsvInspection} from '../utils/inspectIndicatorCsv';

import {inspectCsvTimes,type CsvTimeFormat} from '../utils/inspectCsvTimes';

export function IndicatorCsvInspector(){
 const [inspection,setInspection]=useState<CsvInspection|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [timeColumn,setTimeColumn]=useState(''),[timeFormat,setTimeFormat]=useState<CsvTimeFormat>('iso-offset');
 const timing=useMemo(()=>inspection&&timeColumn!==''?inspectCsvTimes(inspection.records.map(row=>row[Number(timeColumn)]),timeFormat):null,[inspection,timeColumn,timeFormat]);
 const request=useRef(0);
 async function inspect(file:File|undefined){
  const id=++request.current;setInspection(null);setTimeColumn('');setTimeFormat('iso-offset');setError('');setBusy(!!file);
  if(!file)return;
  try{
   if(file.size>MAX_INDICATOR_CSV_BYTES)throw new Error('CSV exceeds the 5 MB limit.');
   const source=await file.text();
   if(id!==request.current)return;
   setInspection(inspectIndicatorCsv(source));
  }catch(cause){if(id===request.current)setError(cause instanceof Error?cause.message:'Unable to read this CSV.');}
  finally{if(id===request.current)setBusy(false);}
 }
 return <details className="border rounded-lg p-3"><summary className="cursor-pointer font-medium">Inspect an indicator CSV</summary><div className="space-y-3 mt-3">
  <p className="text-sm">Select your TradingView chart export to inspect its columns. The file stays in this browser; it is not uploaded or saved. Limit: 5 MB, 50,000 rows and 200 columns.</p>
  <label className="block">TradingView CSV file<input type="file" accept=".csv,text/csv" className="block mt-2 max-w-full" onChange={event=>void inspect(event.target.files?.[0])}/></label>
  {busy&&<p role="status">Inspecting CSV…</p>}{error&&<p role="alert">{error}</p>}
  {inspection&&<><p role="status">{inspection.rows.toLocaleString()} data rows · {inspection.columns.length} columns</p><div className="overflow-x-auto"><table className="text-sm w-full text-left"><caption className="text-left mb-2">Column contents only; numeric values are not interpreted as signals.</caption><thead><tr>{['Column','Numeric','Blank','Other text','Numeric range'].map(title=><th key={title} className="p-2">{title}</th>)}</tr></thead><tbody>{inspection.columns.map(column=><tr key={column.name} className="border-t"><th scope="row" className="p-2 break-all">{column.name}</th><td className="p-2">{column.numeric}</td><td className="p-2">{column.missing}</td><td className="p-2">{column.text}</td><td className="p-2">{column.minimum===null?'Unavailable':`${column.minimum} to ${column.maximum}`}</td></tr>)}</tbody></table></div>
  <fieldset className="border rounded-lg p-3 space-y-3"><legend>Candle timestamp checks</legend><div className="flex flex-wrap gap-3"><label>Time column<select className="block border rounded p-2 max-w-full" value={timeColumn} onChange={event=>setTimeColumn(event.target.value)}><option value="">Choose a column</option>{inspection.columns.map((column,index)=><option key={column.name} value={index}>{column.name}</option>)}</select></label><label>Timestamp format<select className="block border rounded p-2 max-w-full" value={timeFormat} onChange={event=>setTimeFormat(event.target.value as CsvTimeFormat)}><option value="iso-offset">ISO with timezone offset</option><option value="unix-seconds">Unix seconds</option><option value="unix-milliseconds">Unix milliseconds</option></select></label></div>
  <p className="text-sm">ISO example: 2026-01-02T09:15:00+05:30. Date-only and timezone-free values are rejected. Unix values must be whole numbers; confirm seconds versus milliseconds from the export.</p>
  {timing&&<div role="status" className="space-y-2 text-sm"><p>{timing.valid} valid · {timing.blank} blank · {timing.invalid} invalid</p><p>{timing.duplicates} repeated timestamps · {timing.backward} backwards steps between valid records</p><p className="break-all">Earliest (UTC): {timing.earliest??'Unavailable'}<br/>Latest (UTC): {timing.latest??'Unavailable'}</p><p>{timing.blank||timing.invalid||timing.duplicates||timing.backward?'Timestamp issues require review before comparison.':'No timestamp format or ordering issues found.'} Market sessions, missing candles and live signal availability are not verified. Rows are never reordered or removed.</p></div>}
  </fieldset></>}
  <p className="text-sm">Blank values remain missing; zero is a numeric value. Labels such as NaN remain text. This check does not verify the stock, timeframe, timestamp authenticity, settings, repainting or buy/sell meanings. No performance result or trading decision is produced.</p>
 </div></details>;
}
