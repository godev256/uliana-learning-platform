const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
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
 const book=mergeValue(base,local,remote);
 const previous=new Map(local.items.map(item=>[item.id,item]));
 // Preserve unchanged SVG/image components when another page receives a stroke.
 const items=book.items.map(item=>equal(previous.get(item.id),item)?previous.get(item.id):item);
 return {...book,items,pageCount:Math.max(book.pageCount,...items.map(item=>item.page+1))};
}
export class BoardSync {
 constructor({remote,local=remote.notebook,request,onRemote=()=>{},onState=()=>{}}){
  this.base=remote.notebook;this.local=local;this.revision=remote.revision;this.request=request;this.onRemote=onRemote;this.onState=onState;this.stopped=false;
 }
 get dirty(){return !equal(this.local,this.base);}
 state(error){this.lastError=error;if(!this.stopped)this.onState({dirty:this.dirty,saving:!!this.saving,error,revision:this.revision,notebook:this.local});}
 change(book){if(this.stopped||equal(book,this.local))return;this.local=book;this.state();this.schedule();}
 schedule(){if(!this.timer&&!this.stopped)this.timer=setTimeout(()=>{this.timer=null;void this.flush();},80);}
 accept(remote){
  if(this.stopped||remote.unchanged||remote.revision<=this.revision)return;
  const previous=this.local;
  this.local=mergeNotebooks(this.base,this.local,remote.notebook);this.base=remote.notebook;this.revision=remote.revision;
  if(!this.stopped){this.onRemote(this.local,previous);this.state();}
 }
 async refresh(wait=false){
  if(this.stopped||this.reading)return;
  this.reading=true;const controller=new AbortController();this.readController=controller;
  try{const remote=await this.request(undefined,{wait,since:this.revision,signal:controller.signal});if(this.saving)await this.saving;this.accept(remote);if(this.dirty)this.schedule();else if(this.lastError)this.state();}
  catch(error){if(!this.stopped&&error.name!=="AbortError")this.state(error);}
  finally{this.reading=false;if(this.readController===controller)this.readController=null;}
 }
 flush(){
  clearTimeout(this.timer);this.timer=null;
  if(this.saving)return this.saving;
  if(this.stopped||!this.dirty)return Promise.resolve(!this.dirty);
  this.saving=(async()=>{
   let retries=0;
   while(!this.stopped&&this.dirty){
    const sent=this.local,revision=this.revision;this.state();
    try{const result=await this.request({notebook:sent,revision});this.base=sent;this.revision=result.revision;retries=0;}
    catch(error){if(error.status===409&&retries++<3){try{this.accept(await this.request());continue;}catch(readError){error=readError;}}this.state(error);return false;}
   }
   return !this.dirty;
  })().finally(()=>{this.saving=null;this.state(this.lastError);});
  return this.saving;
 }
 start(){
  const poll=async()=>{if(this.stopped)return;await this.refresh(true);if(!this.stopped)this.poll=setTimeout(poll,this.lastError?1000:100);};
  void poll();if(this.dirty)this.schedule();
 }
 stop(){this.stopped=true;clearTimeout(this.poll);clearTimeout(this.timer);this.readController?.abort();}
}
