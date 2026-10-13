export type CsvTimeFormat='iso-offset'|'unix-seconds'|'unix-milliseconds';
export type CsvTimeReport={valid:number;blank:number;invalid:number;duplicates:number;backward:number;earliest:string|null;latest:string|null};

function parseTime(value:string,format:CsvTimeFormat):number|null {
 if(format==='unix-seconds'||format==='unix-milliseconds'){
  if(!/^-?\d+$/.test(value))return null;
  const raw=Number(value),ms=raw*(format==='unix-seconds'?1000:1);
  return Number.isSafeInteger(raw)&&Number.isSafeInteger(ms)&&Number.isFinite(new Date(ms).getTime())?ms:null;
 }
 // Require an explicit offset; never interpret naive timestamps in the device timezone.
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!match)return null;
 const [,year,month,day,hour,minute,second,offset]=match;
 const y=Number(year),m=Number(month),d=Number(day);
 const leap=y%4===0&&(y%100!==0||y%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(m<1||m>12||d<1||d>days[m-1]||Number(hour)>23||Number(minute)>59||Number(second)>59)return null;
 if(offset!=='Z'&&(Number(offset.slice(1,3))>23||Number(offset.slice(4))>59))return null;
 const ms=Date.parse(value);return Number.isFinite(ms)?ms:null;
}

export function inspectCsvTimes(values:string[],format:CsvTimeFormat):CsvTimeReport {
 if(!['iso-offset','unix-seconds','unix-milliseconds'].includes(format))throw new Error('Choose a supported timestamp format.');
 const report:CsvTimeReport={valid:0,blank:0,invalid:0,duplicates:0,backward:0,earliest:null,latest:null};
 const seen=new Set<number>();let previous:number|null=null,min:number|null=null,max:number|null=null;
 for(const raw of values){
  const value=raw.trim();if(!value){report.blank++;continue;}
  const time=parseTime(value,format);if(time===null){report.invalid++;continue;}
  report.valid++;if(seen.has(time))report.duplicates++;seen.add(time);
  if(previous!==null&&time<previous)report.backward++;
  previous=time;min=min===null?time:Math.min(min,time);max=max===null?time:Math.max(max,time);
 }
 report.earliest=min===null?null:new Date(min).toISOString();report.latest=max===null?null:new Date(max).toISOString();
 return report;
}
