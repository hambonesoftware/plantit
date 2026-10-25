/* Linear-time depth bins. Far-to-near order for alpha compositing. */
'use strict';
let points=null,version=0;
self.onmessage=({data:d})=>{
 if(d.positions){points=d.positions;version=d.version||0;return}
 if(!points)return;
 const {eye,r,u,f,tanX,tanY,id}=d;const count=points.length/3,bins=8192,maxDepth=60;
 const histogram=new Uint32Array(bins),keys=new Int32Array(count);keys.fill(-1);let n=0;
 for(let i=0;i<count;i++){
  const j=i*3,dx=points[j]-eye[0],dy=points[j+1]-eye[1],dz=points[j+2]-eye[2];
  const z=dx*f[0]+dy*f[1]+dz*f[2];if(z<.10||z>maxDepth)continue;
  const x=dx*r[0]+dy*r[1]+dz*r[2],y=dx*u[0]+dy*u[1]+dz*u[2];
  if(Math.abs(x)>z*tanX+.6||Math.abs(y)>z*tanY+.6)continue;
  const key=Math.min(bins-1,Math.floor(z/maxDepth*(bins-1)));keys[i]=key;histogram[key]++;n++;
 }
 const offsets=new Uint32Array(bins);let total=0;for(let b=bins-1;b>=0;b--){offsets[b]=total;total+=histogram[b]}
 const indices=new Uint32Array(n);for(let i=0;i<count;i++)if(keys[i]>=0)indices[offsets[keys[i]]++]=i;
 self.postMessage({indices,id,version},[indices.buffer]);
};
