/* Keep model decoding off the UI thread, including on iPhone/iPad. */
'use strict';
importScripts('splat-math.js?v=2.0.1');
self.onmessage=({data})=>{
 try{
  const model=SplatMath.decode(data.buffer,data.offset,data.transform||null);
  self.postMessage({model},[model.data.buffer,model.positions.buffer]);
 }catch(error){self.postMessage({error:error.message||'Room model could not be decoded.'});}
};
