/* Public, cookie-free Wikipedia lookups. Only the requested plant title is sent. */
(function(root){
'use strict';
const API='https://en.wikipedia.org/w/api.php';
const plain=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').trim();
async function request(params,endpoint=API){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const url=new URL(endpoint);for(const [k,v]of Object.entries({action:'query',format:'json',formatversion:2,origin:'*',...params}))url.searchParams.set(k,String(v));const r=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Wikipedia is temporarily unavailable.');const data=await r.json();if(data.error)throw Error(data.error.info||'Wikipedia could not answer this request.');return data;}catch(error){if(error.name==='AbortError')throw Error('Wikipedia took too long to respond. Try again.');throw error;}finally{clearTimeout(timer)}}
function section(text,pattern){const parts=String(text).split(/\n(?=={2,}\s)/);for(const part of parts){const h=part.match(/^={2,}\s*(.*?)\s*={2,}/);if(h&&pattern.test(h[1]))return part.replace(/^={2,}[^\n]*\n?/,'').trim().slice(0,1100);}return '';}
async function page(title){const data=await request({titles:title,redirects:1,prop:'extracts|pageimages|info|pageprops',inprop:'url',explaintext:1,exsectionformat:'wiki',exchars:14000,piprop:'thumbnail|name',pilicense:'free',pithumbsize:900});const p=data.query?.pages?.[0];if(!p||p.missing||p.pageprops?.disambiguation!==undefined||!/\b(plant|tree|shrub|fern|vine|succulent|flower|orchid|palm|cactus|cacti|botanic|Araceae|Apocynaceae)\b/i.test(p.extract||''))return null;const intro=(p.extract||'').split(/\n={2,}/)[0].trim().slice(0,1800);let image=null;
 if(p.thumbnail?.source&&/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(p.thumbnail.source)){
  image={url:p.thumbnail.source,file:p.pageimage||'',sourceUrl:p.pageimage?'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(p.pageimage):p.fullurl,artist:'',license:'See original image',licenseUrl:''};
  if(p.pageimage){try{const meta=await request({titles:'File:'+p.pageimage,prop:'imageinfo',iiprop:'extmetadata|url'},'https://commons.wikimedia.org/w/api.php');const info=meta.query?.pages?.[0]?.imageinfo?.[0],m=info?.extmetadata;if(m){image.artist=plain(m.Artist?.value);image.license=plain(m.LicenseShortName?.value)||image.license;image.licenseUrl=m.LicenseUrl?.value||'';}if(info?.descriptionurl?.startsWith('https://commons.wikimedia.org/'))image.sourceUrl=info.descriptionurl;}catch{ /* The image source remains linked when credit metadata is unavailable. */ }}
 }
 return {title:p.title,url:p.fullurl||'https://en.wikipedia.org/wiki/'+encodeURIComponent(p.title),extract:intro,habitat:section(p.extract,/habitat|distribution|ecology|range|origin/i),description:section(p.extract,/description/i),family:intro.match(/family\s+([A-Z][a-z]+aceae)/)?.[1]||'',image,fetchedAt:new Date().toISOString()};
}
async function search(query){const data=await request({list:'search',srsearch:String(query).slice(0,160)+' plant',srnamespace:0,srlimit:6,srprop:'snippet'});return (data.query?.search||[]).map(p=>({title:p.title,description:plain(p.snippet)}));}
async function resolve(scientific,common){
 const sci=String(scientific||'').trim(),colloquial=String(common||'').trim();
 let scientificPage=null,commonPage=null;
 if(sci)scientificPage=await page(sci);
 if(colloquial&&colloquial.toLowerCase()!==sci.toLowerCase())commonPage=await page(colloquial);
 else commonPage=scientificPage;
 const chosen=commonPage||scientificPage;if(!chosen)return null;
 const disagree=!!(commonPage&&scientificPage&&commonPage.url!==scientificPage.url);
 return {...chosen,namesChecked:true,scientificTitle:scientificPage?.title||'',commonTitle:commonPage?.title||'',matchNotice:disagree?'Names resolve to different Wikipedia articles. The common-name article is shown; review the scientific name.':!commonPage&&colloquial?'The common name could not be verified. Showing the scientific-name article; review the match.':!scientificPage&&sci?'The scientific name could not be verified. Showing the common-name article.':''};
}
root.PlantItWiki={page,search,resolve};if(typeof module!=='undefined')module.exports=root.PlantItWiki;
})(typeof globalThis!=='undefined'?globalThis:this);
