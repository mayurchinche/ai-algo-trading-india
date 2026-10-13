export const MAX_INDICATOR_CSV_BYTES = 5 * 1024 * 1024;
export type CsvColumn = {name:string; missing:number; numeric:number; text:number; minimum:number|null; maximum:number|null};
export type CsvInspection = {rows:number; columns:CsvColumn[]; records:string[][]};

/** Inspect structure only: plot meanings and signal availability are not inferred. */
export function inspectIndicatorCsv(source:string):CsvInspection {
 if(new TextEncoder().encode(source).length>MAX_INDICATOR_CSV_BYTES) throw new Error('CSV exceeds the 5 MB limit.');
 const input=source.replace(/^\uFEFF/,'');
 const records:string[][]=[];
 let row:string[]=[], field='', quoted=false, closed=false;
 const pushField=()=>{row.push(field);field='';closed=false;if(row.length>200)throw new Error('CSV exceeds 200 columns.');};
 const pushRow=()=>{pushField();records.push(row);row=[];if(records.length>50001)throw new Error('CSV exceeds 50,000 data rows.');};
 for(let i=0;i<input.length;i++) {
  const ch=input[i];
  if(quoted){if(ch==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
  if(ch===','){pushField();continue;}
  if(ch==='\r'||ch==='\n'){pushRow();if(ch==='\r'&&input[i+1]==='\n')i++;continue;}
  if(closed)throw new Error('Unexpected content after a quoted CSV field.');
  if(ch==='"'){if(field)throw new Error('Unexpected quote in an unquoted CSV field.');quoted=true;}else field+=ch;
 }
 if(quoted)throw new Error('CSV contains an unfinished quoted field.');
 if(field||closed||row.length)pushRow();
 if(records.length<2)throw new Error('CSV must contain a header and at least one data row.');
 const names=records[0].map(value=>value.trim());
 if(names.some(name=>!name)||new Set(names).size!==names.length)throw new Error('CSV headers must be nonempty and unique.');
 const columns:CsvColumn[]=names.map(name=>({name,missing:0,numeric:0,text:0,minimum:null,maximum:null}));
 for(let r=1;r<records.length;r++){
  if(records[r].length!==names.length)throw new Error(`CSV record ${r+1} has ${records[r].length} fields; expected ${names.length}.`);
  records[r].forEach((raw,c)=>{
   const value=raw.trim(),column=columns[c];
   if(!value){column.missing++;return;}
   const number=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)?Number(value):NaN;
   if(!Number.isFinite(number)){column.text++;return;}
   column.numeric++;column.minimum=column.minimum===null?number:Math.min(column.minimum,number);column.maximum=column.maximum===null?number:Math.max(column.maximum,number);
  });
 }
 return {rows:records.length-1,columns,records:records.slice(1)};
}
