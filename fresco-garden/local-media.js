/* Browser-local photo album. No photograph is transmitted to the host. */
(function(){
'use strict';
let pending;
function db(){if(!pending)pending=new Promise((resolve,reject)=>{const r=indexedDB.open('plantit-gaussian-media',3);r.onupgradeneeded=()=>{for(const store of ['roomPhotos','plantPhotos','gardenState'])if(!r.result.objectStoreNames.contains(store))r.result.createObjectStore(store,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return pending}
function request(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function mutatePlant(id,file){return db().then(database=>new Promise((resolve,reject)=>{const tx=database.transaction('plantPhotos','readwrite'),store=tx.objectStore('plantPhotos');if(file)store.put({id:Number(id),file,name:file.name});else store.delete(Number(id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)}));}
window.PlantItMedia={
 async loadGarden(){const database=await db();return request(database.transaction('gardenState','readonly').objectStore('gardenState').get('active'));},
 async saveGarden(garden){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('gardenState','readwrite');tx.objectStore('gardenState').put({id:'active',garden});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});},
 async restore(garden,plantPhotos,roomPhotos){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(['gardenState','plantPhotos','roomPhotos'],'readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Restore aborted'));try{tx.objectStore('gardenState').put({id:'active',garden});for(const [name,rows]of [['plantPhotos',plantPhotos],['roomPhotos',roomPhotos]]){const store=tx.objectStore(name);store.clear();for(const row of rows)store.put(row);}}catch(error){tx.abort();reject(error);}});},
 savePlant:mutatePlant,
 removePlant:id=>mutatePlant(id,null),
 async allPlants(){const database=await db();return request(database.transaction('plantPhotos','readonly').objectStore('plantPhotos').getAll())},
 async save(room,file){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('roomPhotos','readwrite');const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);tx.objectStore('roomPhotos').put({id,room,file,name:file.name});tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Photo storage aborted'))})},
 async all(){const database=await db();return request(database.transaction('roomPhotos','readonly').objectStore('roomPhotos').getAll())},
 async clear(room){const database=await db();const rows=await this.all();return new Promise((resolve,reject)=>{const tx=database.transaction('roomPhotos','readwrite');for(const row of rows)if(row.room===room)tx.objectStore('roomPhotos').delete(row.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
};
})();
