/* PlantIt date, care and import rules. Shared by the browser and Node checks. */
(function(root){
'use strict';
const clean=v=>String(v??'').replace(/^\uFEFF/,'').trim();
const key=v=>clean(v).toLowerCase().replace(/[“”"'‘’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function iso(y,m,d){const dt=new Date(Date.UTC(Number(y),Number(m)-1,Number(d)));return dt.getUTCFullYear()===Number(y)&&dt.getUTCMonth()+1===Number(m)&&dt.getUTCDate()===Number(d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;}
function date(v){const s=clean(v);let m=s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);if(m)return iso(m[1],m[2],m[3]);m=s.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);if(m)return iso(m[3].length===2?Number(m[3])+2000:m[3],m[1],m[2]);m=s.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i);if(m)return iso(m[3],months[m[1].slice(0,3).toLowerCase()],m[2]);return null;}
function today(now=new Date()){return iso(now.getFullYear(),now.getMonth()+1,now.getDate());}
function addDays(value,days){const d=date(value);if(!d||!Number.isFinite(Number(days)))return null;const dt=new Date(d+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+Math.round(Number(days)));return dt.toISOString().slice(0,10);}
function interval(value){const s=clean(value).toLowerCase();if(!s)return null;if(/fortnight|biweekly|every other week/.test(s))return 14;if(/weekly|every week/.test(s))return 7;if(/monthly|every month/.test(s))return 30;if(/\d\s*[-–]\s*\d/.test(s))return null;const n=parseFloat(s.match(/\d+(?:\.\d+)?/)?.[0]);if(!Number.isFinite(n)||n<=0)return null;const days=Math.round(n*(/week/.test(s)?7:1));return days>=1&&days<=365?days:null;}
function uniqueEvents(events){const out=[],seen=new Set();for(const event of events||[]){const d=date(event.date);if(clean(event.note||event.text)==='Imported last-watered date'&&(events||[]).some(other=>date(other.date)===d&&clean(other.note||other.text)!=='Imported last-watered date'))continue;if(!d)continue;const note=clean(event.note||event.text);const fingerprint=d+'|'+key(note);if(seen.has(fingerprint))continue;seen.add(fingerprint);out.push({id:clean(event.id)||'event-'+d+'-'+out.length,date:d,note,source:clean(event.source)||'import'});}return out.sort((a,b)=>a.date.localeCompare(b.date));}
function lastWater(p){return [date(p.lastWatered),...(p.waterings||[]).map(e=>date(e.date))].filter(Boolean).sort().at(-1)||null;}
function nextWater(p){return date(p.nextWaterOverride)||(lastWater(p)&&interval(p.intervalDays)?addDays(lastWater(p),interval(p.intervalDays)):null);}
function waterCount(p){return Math.max(0,Number(p.historicWaterCount)||0)+(p.waterings||[]).length;}
function care(p,at=today()){const next=nextWater(p);return {last:lastWater(p),next,due:!!next&&next<=at,overdue:!!next&&next<at,needsSchedule:!next,count:waterCount(p)};}
function guessSpecies(name){const head=clean(name).replace(/^Dead\s+/i,'').split(':')[0].replace(/[“”"].*$/,'').trim();const m=head.match(/^([A-Z][a-z]+)\s+([a-z][a-z-]+)\b/);return m?m[1]+' '+m[2]:'';}
function normalize(input){
 const map={};for(const [k,v] of Object.entries(input||{}))map[key(k)]=v;
 const get=(...keys)=>keys.map(k=>map[key(k)]).find(v=>v!==undefined&&v!==null&&v!=='')??'';
 const name=clean(get('name','title','_sourceTitle'))||'Unnamed plant';
 const log=get('waterings','watering events','activityLog');const waters=Array.isArray(log)?log.filter(e=>!e.type||/water/i.test(e.type)):[];
 let waterings=uniqueEvents(waters);const declared=date(get('lastWatered','last watered','last'));
 if(declared&&!waterings.some(e=>e.date===declared))waterings=uniqueEvents([...waterings,{date:declared,note:'Imported last-watered date',source:'import'}]);
 let every=interval(get('intervalDays','wateringEveryDays','watering interval','water average','waterAverage','water every'));
 let intervalSource=clean(get('intervalSource'))|| (every?'import':'');
 if(!every&&waterings.length>1){const distinct=[...new Set(waterings.map(e=>e.date))];const gaps=distinct.slice(1).map((v,i)=>(Date.parse(v+'T12:00:00Z')-Date.parse(distinct[i]+'T12:00:00Z'))/86400000).filter(n=>n>0&&n<=365).sort((a,b)=>a-b);if(gaps.length){every=Math.round(gaps[Math.floor(gaps.length/2)]);intervalSource='history estimate';}}
 const explicitCount=Number(get('watering count','water count','count'))||0;
 const historic=Math.max(0,Number(get('historicWaterCount'))||0,explicitCount-waterings.length);
 return {id:get('id'),sourceId:clean(get('sourceId')),name,species:clean(get('species','scientific name','botanical name'))||guessSpecies(name),room:clean(get('room','village'))||'',purchasedOn:date(get('purchasedOn','purchased on','purchase date','bought')),lastWatered:declared,intervalDays:every,intervalSource,nextWaterOverride:date(get('nextWaterOverride','next water date','next watered','next watering')),waterings,historicWaterCount:historic,notes:clean(get('notes','note')),family:clean(get('family')),native:clean(get('native','plant origin','plantOrigin')),habitat:clean(get('habitat','natural habitat','naturalHabitat')),light:clean(get('light','sunlight')),wiki:input?.wiki&&typeof input.wiki==='object'?input.wiki:null,bundledPhoto:clean(get('bundledPhoto')),demo:input?.demo===true};
}
function markdown(text,filename='plant.md'){
 const raw=clean(text),lines=raw.split(/\r?\n/);const title=lines.find(l=>/^#\s+/.test(l))?.replace(/^#\s+/,'').trim()||filename.split('/').at(-1).replace(/\.[^.]+$/,'').replace(/ [a-f0-9]{32}$/i,'');
 const fields={name:title,notes:raw,sourceId:filename.match(/([a-f0-9]{32})(?:\.[a-z]+)?$/i)?.[1]||''};let context='',lastDate=null;const waterings=[];
 const waterHead=/^(?:last\s+watered|watering(?:\s+(?:history|log|events))?|watered|water\s+log)\s*:?\s*$/i;
 const sectionHead=/^(?:last\s+repotted|repot(?:ted|ting)?|purchased\s+on|purchase(?:\s+history)?|fertili[sz](?:ed|ing|ation)|prun(?:ed|ing)|notes?|propagat(?:ed|ion))\s*:?\s*$/i;
 for(const original of lines){
  const line=original.replace(/^\s*(?:[-*+]\s+|#{1,6}\s*)/,'').replace(/\*\*|`/g,'').trim();if(!line)continue;
  const pair=line.match(/^([A-Za-z][A-Za-z _-]{1,38})\s*:\s*(.*)$/);
  if(pair&&pair[2]){const k=key(pair[1]);if(!Object.hasOwn(fields,k))fields[k]=pair[2];if(/^(last watered|last repotted|purchased on|next water date|water average)$/.test(k)){context='';continue;}}
  if(waterHead.test(line)){context='water';lastDate=null;continue;}
  if(sectionHead.test(line)){context='other';lastDate=null;continue;}
  if(/^#{1,6}\s/.test(original)&&!waterHead.test(line))context='other';
  const d=date(line);if(d)lastDate=d;
  const negated=/\b(not watered|didn.t water|no watering|needs? water|water tomorrow|water due)\b/i.test(line);
  const explicit=/\b(watered|watering|waterhose|hose|soaked|bottom.watered)\b/i.test(line)&&!negated;
  if(d&&(context==='water'||explicit)&&!negated)waterings.push({date:d,note:line,source:'import'});
  else if(!d&&explicit&&lastDate&&context!=='other')waterings.push({date:lastDate,note:line,source:'import'});
  if(d&&/\b(purchased|bought|acquired)\b/i.test(line)&&!fields['purchased on'])fields['purchased on']=d;
 }
 fields.waterings=uniqueEvents(waterings);return normalize(fields);
}
function csv(text){const rows=[];let row=[],cell='',quoted=false;const s=String(text).replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(v=>v.trim()))rows.push(row);if(rows.length<2)return [];const headers=rows.shift().map(clean);return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||'']))).filter(r=>clean(r.Name||r.name||r.Title||r.title)).map(normalize);}
function mergeFields(a,b){const result={...a};for(const [k,v]of Object.entries(b))if((result[k]===null||result[k]===''||result[k]===undefined)&&v!==null&&v!=='')result[k]=v;result.waterings=uniqueEvents([...(a.waterings||[]),...(b.waterings||[])]);result.historicWaterCount=Math.max(a.historicWaterCount||0,b.historicWaterCount||0);return result;}
function bundle(documents){const md=[],summaries=[];const warnings=[];for(const doc of documents){try{const ext=doc.name.split('.').at(-1).toLowerCase();if(ext==='csv')summaries.push(...csv(doc.text));else if(ext==='json'){const data=JSON.parse(doc.text);const arr=Array.isArray(data)?data:data.plants?[...data.plants]:[data];md.push(...arr.map(normalize));}else{const sections=doc.text.split(/(?=^#\s+[^#])/m).filter(s=>s.trim());for(const section of sections)md.push(markdown(section,doc.name));}}catch(error){warnings.push(doc.name+': '+error.message);}}
 const result=[];for(const p of md){const existing=p.sourceId?result.find(q=>q.sourceId===p.sourceId):null;if(existing)Object.assign(existing,mergeFields(existing,p));else result.push(p);}
 const byName=new Map();for(const p of result){const k=key(p.name);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(p);}
 const csvSeen=new Map();for(const p of summaries){const k=key(p.name);if(csvSeen.has(k))csvSeen.set(k,mergeFields(csvSeen.get(k),p));else csvSeen.set(k,p);}
 for(const [k,p]of csvSeen){const matches=byName.get(k)||[];if(matches.length===1)Object.assign(matches[0],mergeFields(matches[0],p));else if(!matches.length){result.push(p);byName.set(k,[p]);}}
 return {plants:result.filter(p=>p.name!=='Unnamed plant'),warnings};
}
function mergeImport(existing,incoming){const result=existing.map(p=>({...p,waterings:[...(p.waterings||[])]}));let added=0,updated=0;for(const source of incoming){const p=normalize(source);let match=p.sourceId?result.find(q=>q.sourceId===p.sourceId):null;if(!match&&!p.sourceId){const matches=result.filter(q=>key(q.name)===key(p.name)&&(!p.purchasedOn||!q.purchasedOn||p.purchasedOn===q.purchasedOn));if(matches.length===1)match=matches[0];}if(match){const merged=mergeFields(match,p);if(p.lastWatered&&(!match.lastWatered||p.lastWatered>match.lastWatered))merged.lastWatered=p.lastWatered;Object.assign(match,merged);updated++;}else{p.id=result.reduce((n,q)=>Math.max(n,Number(q.id)||0),-1)+1;p.demo=false;result.push(p);added++;}}return {plants:result,added,updated};}
const api={clean,key,date,today,addDays,interval,uniqueEvents,lastWater,nextWater,waterCount,care,guessSpecies,normalize,markdown,csv,bundle,mergeImport};if(typeof module!=='undefined')module.exports=api;root.PlantItCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
