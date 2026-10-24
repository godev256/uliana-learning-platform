import {assetScope} from '../account/client.js';
import {readAsset} from './board-assets.js';

// Keep decoded pages and stable object URLs while the board is open. A small
// queue avoids hundreds of simultaneous downloads when a PDF has many pages.
const images=new Map(),queue=[];
let running=0;
function drain(){
 while(running<4&&queue.length){const job=queue.shift();running++;void job().finally(()=>{running--;drain();});}
}
function queued(work){return new Promise((resolve,reject)=>{queue.push(async()=>{try{resolve(await work());}catch(error){reject(error);}});drain();});}
export function retainBoardImage(id,owner=assetScope()){
 const key=JSON.stringify([owner,id]);let entry=images.get(key);
 if(!entry){
  entry={refs:0,url:null,image:null};images.set(key,entry);
  entry.ready=queued(async()=>{
   const blob=await readAsset(id,owner);if(!blob)throw new Error('Не удалось загрузить изображение страницы.');
   const url=URL.createObjectURL(blob),image=new Image();
   try{image.src=url;await image.decode();entry.url=url;entry.image=image;return url;}
   catch(error){URL.revokeObjectURL(url);throw error;}
  });
  // Subscribers handle errors; also handle a released subscription's rejection.
  void entry.ready.catch(()=>{if(images.get(key)===entry)images.delete(key);});
 }
 clearTimeout(entry.timer);entry.refs++;
 let released=false;
 return {ready:entry.ready,release(){
  if(released)return;released=true;if(--entry.refs)return;
  entry.timer=setTimeout(()=>{if(entry.refs)return;void entry.ready.catch(()=>{}).finally(()=>{if(entry.refs||images.get(key)!==entry)return;if(entry.url)URL.revokeObjectURL(entry.url);entry.image=null;images.delete(key);});},500);
 }};
}

export function retryBoardImages(){window.dispatchEvent(new Event("board-image-retry"));}
