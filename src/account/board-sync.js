import {notebookPatch,applyNotebookPatch} from "./board-patches.js";
const equal=(a,b)=>a===b||(a?.items&&b?.items ? a.pageCount===b.pageCount&&a.items.length===b.items.length&&a.items.every((item,i)=>equal(item,b.items[i])) : JSON.stringify(a)===JSON.stringify(b));
// Merge fields independently, including construction lists keyed by stable IDs.
function mergeValue(base,local,remote){
 if(equal(local,base))return remote;
 if(equal(remote,base)||equal(local,remote))return local;
 if(Array.isArray(local)&&Array.isArray(remote)&&[...local,...remote,...(base??[])].every(v=>v&&typeof v==='object'&&typeof v.id==='string')){
  const b=new Map((base??[]).map(v=>[v.id,v])),l=new Map(local.map(v=>[v.id,v])),r=new Map(remote.map(v=>[v.id,v]));
  return [...new Set([...r.keys(),...l.keys()])].flatMap(id=>{
   if(b.has(id)&&(!l.has(id)||!r.has(id)))return []; // A deletion must not be resurrected by another edit.
   return [mergeValue(b.get(id),l.get(id),r.get(id))].filter(Boolean);
  });
 }
 if(local&&remote&&!Array.isArray(local)&&!Array.isArray(remote)&&typeof local==='object'&&typeof remote==='object'){
  return Object.fromEntries([...new Set([...Object.keys(remote),...Object.keys(local)])].map(key=>[key,mergeValue(base?.[key],local[key],remote[key])]));
 }
 return local; // Concurrent changes to one scalar use the current editor's value.
}
export function mergeNotebooks(base,local,remote){
 // Merge notebook objects by ID first. Comparing complete serialized lessons for
 // each undo entry made remote strokes stall large, image-heavy boards.
 const before=new Map(base.items.map(item=>[item.id,item])),ours=new Map(local.items.map(item=>[item.id,item])),theirs=new Map(remote.items.map(item=>[item.id,item]));
 const order=equal(local,base)?[...theirs.keys()]:equal(remote,base)?[...ours.keys()]:[...new Set([...theirs.keys(),...ours.keys()])];
 const items=order.flatMap(id=>{
  if(before.has(id)&&(!ours.has(id)||!theirs.has(id)))return [];
  const item=mergeValue(before.get(id),ours.get(id),theirs.get(id));
  return item?[equal(ours.get(id),item)?ours.get(id):item]:[];
 });
 return {pageCount:Math.max(mergeValue(base.pageCount,local.pageCount,remote.pageCount),...items.map(item=>item.page+1)),items};
}
export class BoardSync {
 constructor({remote,local=remote.notebook,request,onRemote=()=>{},onState=()=>{}}){
  this.patchProtocol=!!remote.patchProtocol;this.base=remote.notebook;this.local=local;this.revision=remote.revision;this.request=request;this.onRemote=onRemote;this.onState=onState;this.stopped=false;
 }
 get dirty(){return !equal(this.local,this.base);}
 state(error){this.lastError=error;if(!this.stopped)this.onState({dirty:this.dirty,saving:!!this.saving,error,revision:this.revision,notebook:this.local});}
 change(book){if(this.stopped||equal(book,this.local))return;this.local=book;this.state();this.schedule();}
 schedule(delay=80){if(!this.timer&&!this.stopped)this.timer=setTimeout(()=>{this.timer=null;void this.saveOnce();},delay);}
 accept(remote){
  if(this.stopped||remote.unchanged||remote.revision<=this.revision)return;
  const previous=this.local;
  this.local=mergeNotebooks(this.base,this.local,remote.notebook);this.base=remote.notebook;this.revision=remote.revision;
  if(!this.stopped){this.onRemote(this.local,previous);this.state();}
 }
 async receive(remote){
  if(this.saving)await this.saving;
  if(this.stopped||remote.revision<=this.revision)return;
  if(remote.type==='commit'){
   if(remote.revision!==this.revision+1||!remote.patch){void this.catchUp();return;}
   this.accept({revision:remote.revision,notebook:applyNotebookPatch(this.base,remote.patch)});
  }else if(remote.patches){
   let book=this.base,revision=this.revision;
   for(const entry of remote.patches){if(entry.revision<=revision)continue;if(entry.revision!==revision+1)throw new Error('Доска требует обновления.');book=applyNotebookPatch(book,entry.patch);revision=entry.revision;}
   if(revision!==remote.revision)throw new Error('Доска требует обновления.');this.accept({revision,notebook:book});
  }else this.accept(remote);
  if(this.dirty)this.schedule();else if(this.lastError)this.state();
 }
 async catchUp(){this.readController?.abort();if(this.reading){this.needsRefresh=true;return;}await this.refresh();}
 async refresh(wait=false){
  if(this.stopped||this.reading)return;
  this.reading=true;const controller=new AbortController();this.readController=controller;
  try{const remote=await this.request(undefined,{wait,since:this.revision,patches:this.patchProtocol,signal:controller.signal});await this.receive(remote);}
  catch(error){if(!this.stopped&&error.name!=="AbortError")this.state(error);}
  finally{this.reading=false;if(this.readController===controller)this.readController=null;if(this.needsRefresh){this.needsRefresh=false;void this.refresh();}}
 }
 saveOnce(){
  clearTimeout(this.timer);this.timer=null;
  if(this.saving)return this.saving;
  if(this.stopped||!this.dirty)return Promise.resolve(!this.dirty);
  const sent=this.local,revision=this.revision,patch=this.patchProtocol?notebookPatch(this.base,sent):undefined;
  this.saving=(async()=>{
   try{const result=await this.request({notebook:sent,revision,...(patch?{patch}:{})});this.base=sent;this.revision=result.revision;this.lastError=undefined;return true;}
   catch(error){if(error.status===409){try{this.accept(await this.request());this.lastError=undefined;return true;}catch(readError){error=readError;}}this.state(error);return false;}
  })().finally(()=>{this.saving=null;this.state(this.lastError);if(this.dirty)this.schedule(this.lastError?1000:80);});
  this.state();return this.saving;
 }
 async flush(){let attempts=0;while(!this.stopped&&this.dirty&&attempts++<20){if(!await this.saveOnce())return false;}return !this.dirty;}
 start(){
  const poll=async()=>{if(this.stopped)return;await this.refresh(true);if(!this.stopped)this.poll=setTimeout(poll,this.lastError?1000:100);};
  void poll();if(this.dirty)this.schedule();
 }
 stop(){this.stopped=true;clearTimeout(this.poll);clearTimeout(this.timer);this.readController?.abort();}
}
