/* PlantIt: perspective projection of anisotropic 3D covariance ellipsoids.
   Standard .splat input. Instanced quads, Gaussian opacity, depth compositing.
   The supplied conservatory geometry is authored, not a trained reconstruction. */
(function(){
'use strict';
let M=window.SplatMath;
const VERTEX=`#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 corner;
layout(location=1) in uint splatIndex;
uniform sampler2D sceneData;
uniform int textureWidth;
uniform vec3 eye;
uniform mat3 cameraBasis;
uniform vec2 focal;
uniform vec2 viewport;
out vec2 gaussianCoord;
out vec4 gaussianColor;
vec4 readData(int i){return texelFetch(sceneData,ivec2(i%textureWidth,i/textureWidth),0);}
void main(){
 int base=int(splatIndex)*4;
 vec4 t0=readData(base),t1=readData(base+1),t2=readData(base+2),t3=readData(base+3);
 vec3 p=cameraBasis*(t0.xyz-eye);
 if(p.z<0.06){gl_Position=vec4(2.,2.,2.,1.);gaussianCoord=vec2(10.);gaussianColor=vec4(0.);return;}
 mat3 C=mat3(t1.x,t1.y,t1.z,t1.y,t1.w,t2.x,t1.z,t2.x,t2.y);
 mat3 cv=cameraBasis*C*transpose(cameraBasis);
 float iz=1./p.z;
 vec3 jx=vec3(focal.x*iz,0.,-focal.x*p.x*iz*iz);
 vec3 jy=vec3(0.,focal.y*iz,-focal.y*p.y*iz*iz);
 float a=dot(jx,cv*jx)+0.3,b=dot(jx,cv*jy),c=dot(jy,cv*jy)+0.3;
 float mid=(a+c)*0.5,disc=sqrt(max(0.,(a-c)*(a-c)*0.25+b*b));
 float l1=max(mid+disc,0.3),l2=max(mid-disc,0.3);
 vec2 axis1=abs(b)>0.00001?normalize(vec2(b,l1-a)):(a>=c?vec2(1.,0.):vec2(0.,1.));
 vec2 axis2=vec2(-axis1.y,axis1.x);
 vec2 offset=(axis1*sqrt(l1)*corner.x+axis2*sqrt(l2)*corner.y)*3.;
 vec2 center=focal*p.xy*iz;
 gl_Position=vec4((center+offset)*2./viewport,0.,1.);
 gaussianCoord=corner*3.;
 float fog=clamp((p.z-13.)/38.,0.,.40);
 gaussianColor=vec4(mix(vec3(t2.z,t2.w,t3.x),vec3(.94,.91,.82),fog),t0.w);
}`;
const FRAGMENT=`#version 300 es
precision highp float;
in vec2 gaussianCoord;
in vec4 gaussianColor;
out vec4 fragColor;
void main(){
 float r2=dot(gaussianCoord,gaussianCoord);
 if(r2>9.)discard;
 float alpha=min(.99,gaussianColor.a*exp(-.5*r2));
 if(alpha<.003)discard;
 fragColor=vec4(gaussianColor.rgb*alpha,alpha);
}`;
function copyPose(p){return {position:[...p.position],target:[...p.target]}}
class GaussianWorld{
 constructor(canvas){M=window.SplatMath;if(!M)throw Error("The room mathematics library is unavailable.");this.canvas=canvas;this.gl=null;this.failed=null;try{this.gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,powerPreference:'default'});}catch(error){this.contextError=error;}this.ready=false;this.room=0;this.plant=null;this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.quality=innerWidth<650?'balanced':'high';this.pose={position:[0,2.05,4.2],target:[0,2.1,-3]};this.models=[];this.decodeJobs=new Set();this.pendingSort=false;this.sortId=0;this.dirty=true;this.sequence=0;this._resolve=null;this._frame=0;this.restoring=false;this.custom=new Set();this.status=document.querySelector('#world-status');
 if(!this.gl){this.fail('3D is unavailable on this browser. The garden remains available in still mode.');return}
 this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.ready=false;cancelAnimationFrame(this._frame);this._frame=0;document.body.classList.remove('world-ready');this.status.textContent='3D paused. Restoring the garden…';this.sequence++;if(this._resolve){this._resolve(false);this._resolve=null}});
 this.canvas.addEventListener('webglcontextrestored',()=>{this.setup();this.upload();this.ready=true;this.pendingSort=false;document.body.classList.add('world-ready');this.dirty=true;this.tick(performance.now())});
 try{this.setup();this.init().catch(e=>{if(!this.failed)this.fail(e.message);});}catch(e){this.fail(e.message);}
 }
 fail(message){this.failed=message;this.ready=false;this.worker?.terminate();this.worker=null;for(const job of this.decodeJobs||[]){job.worker.terminate();clearTimeout(job.timer);job.reject(Error(message));}this.decodeJobs?.clear();cancelAnimationFrame(this._frame);this._frame=0;if(this._resolve){this._resolve(false);this._resolve=null;}document.body.classList.remove('world-ready','walking');this.status.textContent=message;console.warn('PlantIt Gaussian world:',message);document.dispatchEvent(new CustomEvent('world-fallback',{detail:message}))}
 shader(type,source){const gl=this.gl,s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader compilation failed');return s}
 setup(){const g=this.gl;this.program=g.createProgram();g.attachShader(this.program,this.shader(g.VERTEX_SHADER,VERTEX));g.attachShader(this.program,this.shader(g.FRAGMENT_SHADER,FRAGMENT));g.linkProgram(this.program);if(!g.getProgramParameter(this.program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.program)||'Shader link failed');g.useProgram(this.program);this.locations={};for(const n of ['sceneData','textureWidth','eye','cameraBasis','focal','viewport'])this.locations[n]=g.getUniformLocation(this.program,n);this.vao=g.createVertexArray();g.bindVertexArray(this.vao);const quad=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,quad);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);this.orderBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.orderBuffer);g.enableVertexAttribArray(1);g.vertexAttribIPointer(1,1,g.UNSIGNED_INT,0,0);g.vertexAttribDivisor(1,1);this.texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.texture);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.disable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);g.clearColor(0,0,0,0);g.uniform1i(this.locations.sceneData,0);this.drawCount=0;
 }
 async decodeRoom(buffer,offset,transform=null){
  return new Promise((resolve,reject)=>{
   const worker=new Worker('splat-decode-worker.js');
   const job={worker,reject,timer:null};
   const cleanup=()=>{clearTimeout(job.timer);worker.terminate();this.decodeJobs.delete(job);};
   job.timer=setTimeout(()=>{cleanup();reject(Error('Room model decoding timed out'));},25000);
   this.decodeJobs.add(job);
   worker.onmessage=({data})=>{cleanup();data.error?reject(Error(data.error)):resolve(data.model);};
   worker.onerror=()=>{cleanup();reject(Error('The room decoder could not start. Retry 3D.'));};
   worker.postMessage({buffer,offset,transform},[buffer]);
  });
 }
 async fetchAsset(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('A room file could not be downloaded.');return await r.arrayBuffer();}finally{clearTimeout(timer);}}
 async init(){const manifestData=await this.fetchAsset('assets/scenes/manifest.json');this.manifest=JSON.parse(new TextDecoder().decode(manifestData));const response={ok:true,json:async()=>this.manifest};if(!response.ok)throw Error('The scene manifest could not be loaded.');this.manifest=await response.json();this.status.textContent='Opening the conservatory…';this.models=[];for(const [i,room] of this.manifest.rooms.entries()){if(this.failed)return;this.status.textContent='Loading room '+(i+1)+' of '+this.manifest.rooms.length+'…';const bytes=await this.fetchAsset(room.file);if(this.failed)return;this.models.push(await this.decodeRoom(bytes,room.offset));await new Promise(resolve=>setTimeout(resolve,0));}if(this.failed)return;this.worker=new Worker('splat-sort-worker.js');this.worker.onerror=()=>this.fail('The scene sorter could not start. Reload to retry.');this.worker.onmessage=e=>{if(!this.ready)return;this.pendingSort=false;clearTimeout(this.sortTimer);if(e.data.version!==this.sceneVersion){this.dirty=true;this.requestSort();return;}const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,this.orderBuffer);g.bufferData(g.ARRAY_BUFFER,e.data.indices,g.DYNAMIC_DRAW);this.drawCount=e.data.indices.length;this.draw();if(this.dirty)this.requestSort()};this.upload();this.ready=true;this.failed=null;document.body.classList.add('world-ready');this.status.textContent='Sunroom · 3D Gaussian garden';if(typeof ResizeObserver==='function'){this.resizeObserver=new ResizeObserver(()=>{this.dirty=true;this.requestTick()});this.resizeObserver.observe(this.canvas);}document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.dirty=true;this.requestTick()}});this.bindLook();this.requestTick();document.dispatchEvent(new Event('world-ready'));
 }
 upload(){const count=this.models.reduce((n,m)=>n+m.count,0),full=new Float32Array(count*16),positions=new Float32Array(count*3);let o=0;for(const model of this.models){full.set(model.data,o*16);positions.set(model.positions,o*3);o+=model.count}const g=this.gl,max=g.getParameter(g.MAX_TEXTURE_SIZE);this.textureWidth=Math.min(2048,max);const height=Math.ceil(count*4/this.textureWidth);if(height>max)throw Error('This scene exceeds the graphics memory limit.');const padded=new Float32Array(this.textureWidth*height*4);padded.set(full);g.bindTexture(g.TEXTURE_2D,this.texture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,this.textureWidth,height,0,g.RGBA,g.FLOAT,padded);g.uniform1i(this.locations.textureWidth,this.textureWidth);this.sceneVersion=(this.sceneVersion||0)+1;this.worker?.postMessage({positions,version:this.sceneVersion},[positions.buffer]);this.total=count;this.dirty=true;}
 viewport(){const ratio=this.quality==='high'?Math.min(devicePixelRatio,1.5):this.quality==='low'?.65:Math.min(devicePixelRatio,1);const w=Math.max(1,Math.round(this.canvas.clientWidth*ratio)),h=Math.max(1,Math.round(this.canvas.clientHeight*ratio));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h)}const f=h/(2*Math.tan(58*Math.PI/360));return {w,h,f,tanY:h/(2*f),tanX:w/(2*f)}}
 requestSort(){if(!this.ready||this.pendingSort||document.hidden)return;const v=this.viewport(),b=M.basis(this.pose.position,this.pose.target);this.pendingSort=true;this.dirty=false;clearTimeout(this.sortTimer);this.sortTimer=setTimeout(()=>{if(this.pendingSort)this.fail('Scene sorting timed out. Retry 3D.');},12000);this.worker.postMessage({eye:this.pose.position,r:b.r,u:b.u,f:b.f,tanX:v.tanX,tanY:v.tanY,id:++this.sortId})}
 draw(){if(!this.ready||document.hidden)return;const g=this.gl,v=this.viewport(),b=M.basis(this.pose.position,this.pose.target);g.useProgram(this.program);g.bindVertexArray(this.vao);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.uniform3fv(this.locations.eye,this.pose.position);g.uniformMatrix3fv(this.locations.cameraBasis,false,b.m);g.uniform2f(this.locations.focal,v.f,v.f);g.uniform2f(this.locations.viewport,v.w,v.h);g.clear(g.COLOR_BUFFER_BIT);g.drawArraysInstanced(g.TRIANGLES,0,6,this.drawCount)}
 requestTick(){if(!this._frame)this._frame=requestAnimationFrame(t=>{this._frame=0;this.tick(t)})}
 tick(now){if(!this.ready||document.hidden)return;let moving=false;if(this.travel){const a=this.travel,t=Math.min(1,(now-a.start)/a.duration);const cursor=M.smooth(t)*(a.points.length-1),i=Math.min(a.points.length-2,Math.floor(cursor)),u=M.smooth(cursor-i);this.pose={position:M.mix(a.points[i].position,a.points[i+1].position,u),target:M.mix(a.points[i].target,a.points[i+1].target,u)};this.dirty=true;moving=t<1;if(!moving){this.pose=copyPose(a.points[a.points.length-1]);this.travel=null;document.body.classList.remove('walking');this.status.textContent=this.manifest.rooms[this.room].name+(this.plant===null?' · 3D Gaussian garden':' · '+['Monstera','Golden pothos','Boston fern'][this.plant]);if(this._resolve){this._resolve(true);this._resolve=null}}}if(this.dirty)this.requestSort();this.draw();if(moving)this.requestTick()}
 async move(to,room,plant=null){if(!this.ready)return true;if(this._resolve){this._resolve(false);this._resolve=null}const from=copyPose(this.pose),oldRoom=this.room;this.room=room;this.plant=plant;const sequence=++this.sequence;this.status.textContent=plant===null?'Walking to '+this.manifest.rooms[room].name+'…':'Approaching '+['Monstera','Golden pothos','Boston fern'][plant]+'…';if(!this.motion){this.pose=copyPose(to);this.dirty=true;this.travel=null;document.body.classList.remove('walking');this.status.textContent=this.manifest.rooms[room].name+' · still navigation';this.requestTick();return true}const points=M.route(from,to,oldRoom,room);document.body.classList.add('walking');this.travel={points,start:performance.now(),duration:room===oldRoom?1450:Math.min(4200,2200+Math.abs(room-oldRoom)*650)};this.requestTick();return new Promise(resolve=>{this._resolve=value=>resolve(value&&sequence===this.sequence)})}
 dispose(){this.failed='Renderer stopped';this.ready=false;for(const job of this.decodeJobs||[]){job.worker.terminate();clearTimeout(job.timer);job.reject(Error('Renderer stopped'));}this.decodeJobs?.clear();this.worker?.terminate();this.worker=null;this.resizeObserver?.disconnect();cancelAnimationFrame(this._frame);this._frame=0;clearTimeout(this.sortTimer);if(this._resolve){this._resolve(false);this._resolve=null;}}
 home(room=this.room){if(!this.manifest)return Promise.resolve(true);return this.move(this.manifest.rooms[room].home,room,null)}
 approach(id,room=this.room){if(!this.manifest)return Promise.resolve(true);return this.move(this.manifest.rooms[room].plants[id],room,id)}
 setMotion(value){this.motion=Boolean(value)&&!matchMedia('(prefers-reduced-motion: reduce)').matches;if(!this.motion&&this.travel){const target=this.travel.points.at(-1);this.travel=null;this.pose=copyPose(target);document.body.classList.remove('walking');this.dirty=true;if(this._resolve){this._resolve(true);this._resolve=null}this.requestTick()}}
 setQuality(value){this.quality=['low','balanced','high'].includes(value)?value:'balanced';this.dirty=true;this.requestTick()}
 async importSplat(file,room=this.room){if(!this.ready)throw Error('The 3D renderer is not available.');if(file.size>48*1024*1024)throw Error('Choose a .splat model smaller than 48 MB.');const model=await this.decodeRoom(await file.arrayBuffer(),this.manifest.rooms[room].offset,{normalize:true});this.models[room]=model;this.custom.add(room);this.upload();this.requestTick();await this.home(room);return model.count}
 async restoreRoom(room=this.room){const r=await fetch(this.manifest.rooms[room].file);if(!r.ok)throw Error('The original room could not be loaded.');this.models[room]=await this.decodeRoom(await r.arrayBuffer(),this.manifest.rooms[room].offset);this.custom.delete(room);this.upload();this.requestTick();return this.home(room)}
 bindLook(){let drag=null;this.canvas.addEventListener('pointerdown',e=>{if(!document.body.classList.contains('exploring')||this.travel)return;drag={x:e.clientX,y:e.clientY,target:[...this.pose.target]};this.canvas.setPointerCapture(e.pointerId)});this.canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.x)*.003,dy=(e.clientY-drag.y)*.002;const d=M.sub(drag.target,this.pose.position),length=Math.hypot(...d);const yaw=Math.atan2(d[0],-d[2])-dx,pitch=Math.max(-.65,Math.min(.65,Math.asin(d[1]/length)+dy));this.pose.target=[this.pose.position[0]+Math.sin(yaw)*Math.cos(pitch)*length,this.pose.position[1]+Math.sin(pitch)*length,this.pose.position[2]-Math.cos(yaw)*Math.cos(pitch)*length];this.dirty=true;this.requestTick()});const stop=()=>{drag=null};this.canvas.addEventListener('pointerup',stop);this.canvas.addEventListener('pointercancel',stop)}
}
window.GaussianWorld=GaussianWorld;window.PlantItShaders={vertex:VERTEX,fragment:FRAGMENT};
})();
