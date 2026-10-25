/* PlantIt Gaussian scene mathematics. No external runtime dependencies. */
(function(root){
'use strict';
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);return n>1e-9?a.map(v=>v/n):[0,0,-1]};
function basis(eye,target){const f=norm(sub(target,eye));let r=norm(cross(f,[0,1,0]));if(Math.abs(dot(f,[0,1,0]))>.999)r=[1,0,0];const u=norm(cross(r,f));return {r,u,f,m:new Float32Array([r[0],u[0],f[0],r[1],u[1],f[1],r[2],u[2],f[2]])}}
function covariance(scales,quaternion){let [w,x,y,z]=quaternion;const n=Math.hypot(w,x,y,z)||1;w/=n;x/=n;y/=n;z/=n;const R=[[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y)],[2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x)],[2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)]];const C=Array.from({length:3},()=>Array(3).fill(0));for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)C[i][j]+=R[i][k]*R[j][k]*scales[k]**2;return [C[0][0],C[0][1],C[0][2],C[1][1],C[1][2],C[2][2]]}
function decode(buffer,offset=[0,0,0],transform=null){if(buffer.byteLength%32||!buffer.byteLength)throw Error('This file is not a standard 32-byte .splat model.');const dv=new DataView(buffer),count=buffer.byteLength/32;if(count>1500000)throw Error('Use a scene with fewer than 1.5 million Gaussians.');const data=new Float32Array(count*16),positions=new Float32Array(count*3);let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<count;i++)for(let k=0;k<3;k++){const v=dv.getFloat32(i*32+k*4,true);if(!Number.isFinite(v))throw Error('Scene contains invalid coordinates.');min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v)}const center=min.map((v,k)=>(v+max[k])/2);const scale=transform?6/Math.max(...max.map((v,k)=>v-min[k]),.001):1;
for(let i=0;i<count;i++){const b=i*32,o=i*16;let pos=[0,1,2].map(k=>dv.getFloat32(b+k*4,true));if(transform)pos=[(pos[0]-center[0])*scale,(pos[1]-min[1])*scale,(pos[2]-center[2])*scale-2.5];const sizes=[0,1,2].map(k=>dv.getFloat32(b+12+k*4,true)*scale);if(sizes.some(s=>!Number.isFinite(s)||s<=0||s>1000))throw Error('Scene contains invalid Gaussian scales.');const q=[0,1,2,3].map(k=>(dv.getUint8(b+28+k)-128)/128);const c=covariance(sizes,q);const p=pos.map((v,k)=>v+offset[k]);data.set([...p,dv.getUint8(b+27)/255,c[0],c[1],c[2],c[3],c[4],c[5],dv.getUint8(b+24)/255,dv.getUint8(b+25)/255,dv.getUint8(b+26)/255,0,0,0],o);positions.set(p,i*3)}return {data,positions,count}}
function smooth(t){return t*t*(3-2*t)}
function mix(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t)}
function route(from,to,roomFrom,roomTo){if(roomFrom===roomTo)return [from,to];const step=Math.sign(roomTo-roomFrom),p=[from];for(let r=roomFrom;r!==roomTo;r+=step){const doorway=r*10+step*5;p.push({position:[doorway-step*1.6,2,1],target:[doorway+step*3,2,1]});p.push({position:[doorway+step*1.6,2,1],target:[doorway+step*5,2,1]})}p.push(to);return p}
const api={sub,dot,cross,norm,basis,covariance,decode,smooth,mix,route};if(typeof module!=='undefined')module.exports=api;root.SplatMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
