const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto'),z=require('../vendor/fflate.js');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const B=require('../backup-service.js');
const image=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUv8AAAAASUVORK5CYII=','base64'));
const file=new Blob([image],{type:'image/png'});
const garden={version:4,plants:[{id:7,name:'Private <img src=x onerror=alert(1)> plant',room:'Office',species:'Epipremnum aureum',waterings:[{date:'2026-10-19',note:'Watered'}],intervalDays:9,purchasedOn:'2024-09-13',notes:'Private plant note'}],rooms:['Office','Empty room'],notes:[{text:'Private journal',date:'2026-10-25T12:00:00Z',plantId:7}],wikiEnabled:false,motion:false,scene:1};
(async()=>{const password='Synthetic test only passphrase 7391';
const result=await B.create(garden,[{id:7,name:'plant.png',file}],[{id:'room-photo-1',room:0,name:'room.png',file}],password);
const bytes=new Uint8Array(await result.blob.arrayBuffer());assert.equal(Buffer.from(bytes).includes(Buffer.from('Private journal')),false);
const opened=await B.open(result.blob,password);assert.equal(opened.garden.plants[0].purchasedOn,'2024-09-13');assert.equal(opened.garden.plants[0].intervalDays,9);assert.equal(opened.garden.notes[0].text,'Private journal');assert.deepEqual(opened.garden.rooms,['Office','Empty room']);assert.equal(opened.garden.scene,1);assert.equal(opened.garden.motion,false);assert.equal(opened.plantPhotos.length,1);assert.equal(opened.roomPhotos.length,1);assert.deepEqual(new Uint8Array(await opened.plantPhotos[0].file.arrayBuffer()),image);
await assert.rejects(B.open(result.blob,'wrong password'),/incorrect|damaged/);bytes[bytes.length-1]^=1;await assert.rejects(B.open(new Blob([bytes]),password),/incorrect|damaged/);
await assert.rejects(B.create(garden,[],[],'short'),/12 characters/);
assert.throws(()=>B.validateGarden({...garden,plants:[garden.plants[0],garden.plants[0]]}),/duplicate/);
assert.throws(()=>B.validateGarden({...garden,rooms:['Other']}),/missing room/);
// Construct an authenticated but unsafe archive: restore must still reject it.
const badZip=z.zipSync({'../evil.js':new TextEncoder().encode('no execution')});const header=bytes.slice(0,40),salt=header.slice(8,24),iv=header.slice(24,36),material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']),key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt']);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:header},key,badZip);await assert.rejects(B.open(new Blob([header,encrypted]),password),/Unexpected/);
console.log('PASS: complete encrypted round trip, exact photos, dates, rooms, journal, wrong password, tampering, duplicate IDs and unsafe archive rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
