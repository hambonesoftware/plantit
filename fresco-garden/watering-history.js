(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./garden-core.js'):root.PlantItCore;
function days(events){const map=new Map();for(const e of events||[]){const date=C.date(e.date);if(!date)continue;if(!map.has(date))map.set(date,[]);map.get(date).push(e);}return [...map].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,events])=>({date,events}));}
function month(value,offset=0){const valid=C.date(value+'-01');if(!valid)throw Error('Invalid month');const d=new Date(valid+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7);}
function grid(value,events){const start=new Date(month(value)+'-01T12:00:00Z'),year=start.getUTCFullYear(),m=start.getUTCMonth(),count=new Date(Date.UTC(year,m+1,0)).getUTCDate(),byDay=new Map(days(events).map(d=>[d.date,d.events]));return {leading:start.getUTCDay(),cells:Array.from({length:count},(_,i)=>{const date=value+'-'+String(i+1).padStart(2,'0');return {day:i+1,date,events:byDay.get(date)||[]};})};}
const api={days,month,grid};if(typeof module!=='undefined')module.exports=api;root.PlantItHistory=api;
})(typeof globalThis!=='undefined'?globalThis:this);
