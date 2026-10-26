'use strict';
const CACHE='plantit-fresco-v3.3.0';
const SHELL=['watering-history.js?v=3.3.0','backup-service.js?v=3.3.0','garden-core.js?v=3.3.0','wiki-service.js?v=3.3.0','vendor/fflate.js','assets/plant-placeholder.svg','./','index.html','style.css?v=3.3.0','app.js?v=3.3.0','local-media.js?v=3.3.0','manifest.webmanifest','assets/plantit-icon.svg','assets/fonts.css','assets/credits.json','assets/fresco-sunroom.jpg','assets/fresco-vine-house.jpg','assets/fresco-fern-alcove.jpg','assets/plant-0.jpg','assets/plant-1.jpg','assets/plant-2.jpg','assets/dm-sans-0.ttf','assets/dm-sans-1.ttf','assets/dm-sans-2.ttf','assets/dm-sans-3.ttf'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&(key.startsWith('plantit-gaussian-garden-')||key.startsWith('plantit-fresco-'))).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin)return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}
  return response;
 }).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('./'):Response.error()))));
});
