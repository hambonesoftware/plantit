/* Browser-local photo album. No photograph is transmitted to the host. */
(function(){
'use strict';
let pending;
function db(){if(!pending)pending=new Promise((resolve,reject)=>{const r=indexedDB.open('plantit-gaussian-media',1);r.onupgradeneeded=()=>r.result.createObjectStore('roomPhotos',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return pending}
function request(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
window.PlantItMedia={
 async save(room,file){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('roomPhotos','readwrite');const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);tx.objectStore('roomPhotos').put({id,room,file,name:file.name});tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Photo storage aborted'))})},
 async all(){const database=await db();return request(database.transaction('roomPhotos','readonly').objectStore('roomPhotos').getAll())},
 async clear(room){const database=await db();const rows=await this.all();return new Promise((resolve,reject)=>{const tx=database.transaction('roomPhotos','readwrite');for(const row of rows)if(row.room===room)tx.objectStore('roomPhotos').delete(row.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
};
})();
