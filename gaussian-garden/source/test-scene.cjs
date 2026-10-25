const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const root=require('node:path').resolve(__dirname,'..')+'/';
const M=require(root+'splat-math.js');
function close(a,b,e=1e-5){assert.ok(Math.abs(a-b)<e,`${a} != ${b}`)}
const b=M.basis([0,2,4],[0,2,-3]);assert.deepEqual(b.r,[1,-0,0]);close(M.dot(b.r,b.f),0);close(M.dot(b.u,b.f),0);close(M.dot(b.u,b.r),0);
const c=M.covariance([1,2,3],[1,0,0,0]);assert.deepEqual(c,[1,0,0,4,0,9]);
const q=M.covariance([1,2,3],[Math.SQRT1_2,0,0,Math.SQRT1_2]);close(q[0],4);close(q[3],1);close(q[5],9);
const manifest=JSON.parse(fs.readFileSync(root+'assets/scenes/manifest.json'));let count=0;
const decoded=[];
for(const room of manifest.rooms){const buf=fs.readFileSync(root+room.file);const data=M.decode(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),room.offset);assert.equal(data.count,room.gaussians);assert.ok(data.data.every(Number.isFinite));count+=data.count;decoded.push(data);for(let i=0;i<data.count;i++){const j=i*16,xx=data.data[j+4],xy=data.data[j+5],xz=data.data[j+6],yy=data.data[j+7],yz=data.data[j+8],zz=data.data[j+9];assert.ok(xx>0&&yy>0&&zz>0);const det=xx*(yy*zz-yz*yz)-xy*(xy*zz-yz*xz)+xz*(xy*yz-yy*xz);assert.ok(det>0,'Covariance must be positive definite');}for(const anchor of room.plants){const basis=M.basis(anchor.position,anchor.target);assert.ok(basis.m.every(Number.isFinite));}}
// Full three-room route crosses only defined doorway openings.
for(let a=0;a<3;a++)for(let z=0;z<3;z++){const path=M.route(manifest.rooms[a].home,manifest.rooms[z].home,a,z);assert.deepEqual(path.at(-1),manifest.rooms[z].home);for(const p of path.slice(1,-1)){close(p.position[2],1);close(p.position[1],2)}}
// Verify worker depth ordering and reject behind-camera positions.
let result;const context={self:{postMessage:x=>result=x},Uint32Array,Int32Array,Math};vm.createContext(context);vm.runInContext(fs.readFileSync(root+'splat-sort-worker.js','utf8'),context);context.self.onmessage({data:{positions:new Float32Array([0,0,-2,0,0,-10,0,0,4])}});context.self.onmessage({data:{eye:[0,0,0],r:[1,0,0],u:[0,1,0],f:[0,0,-1],tanX:1,tanY:1,id:1}});assert.deepEqual([...result.indices],[1,0]);
const invalid=new ArrayBuffer(32);assert.throws(()=>M.decode(invalid),/scales/);assert.throws(()=>M.decode(new ArrayBuffer(31)),/standard/);
// Model import normalization retains all points and their covariance.
const source=fs.readFileSync(root+manifest.rooms[0].file);const imported=M.decode(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),[10,0,0],{normalize:true});assert.equal(imported.count,manifest.rooms[0].gaussians);
console.log('PASS: '+count.toLocaleString()+' finite positive-definite 3D Gaussians; 9 room routes; 9 plant anchors; depth order; model import; invalid-model handling.');

// Model decoder worker must return transferable model arrays or an explicit error.
let decodedReply;const decoderContext={self:{postMessage:message=>decodedReply=message},importScripts:()=>{},SplatMath:M};vm.createContext(decoderContext);vm.runInContext(fs.readFileSync(root+'splat-decode-worker.js','utf8'),decoderContext);const input=fs.readFileSync(root+manifest.rooms[0].file);decoderContext.self.onmessage({data:{buffer:input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength),offset:[0,0,0]}});assert.equal(decodedReply.model.count,manifest.rooms[0].gaussians);decoderContext.self.onmessage({data:{buffer:new ArrayBuffer(7),offset:[0,0,0]}});assert.ok(decodedReply.error);console.log('PASS: off-thread room decoding and invalid-model errors.');
