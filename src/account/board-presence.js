import {boardId} from '../components/board-id.js';
const empty=[];
export const noPresence={subscribe:()=>()=>{},getSnapshot:()=>empty,move:()=>{}};
export class BoardPresence {
 constructor(request){this.request=request;this.clientId=boardId();this.cursor=null;this.peers=empty;this.listeners=new Set();this.stopped=false;}
 subscribe=listener=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 getSnapshot=()=>this.peers;
 move=cursor=>{clearTimeout(this.touchTimer);this.cursor=cursor;};
 releaseTouch=()=>{clearTimeout(this.touchTimer);this.touchTimer=setTimeout(()=>{this.cursor=null;},700);};
 publish(peers){
  const next=peers.filter(peer=>peer&&typeof peer.id==='string'&&['teacher','student'].includes(peer.role)&&Number.isInteger(peer.cursor?.page)&&Number.isFinite(peer.cursor.x)&&Number.isFinite(peer.cursor.y)).sort((a,b)=>a.id.localeCompare(b.id));
  if(JSON.stringify(next)===JSON.stringify(this.peers))return;this.peers=next;for(const listener of this.listeners)listener();
 }
 start(){
  this.hide=()=>{clearTimeout(this.touchTimer);this.cursor=null;this.publish([]);void this.request({clientId:this.clientId,cursor:null},{keepalive:true}).catch(()=>{});};
  window.addEventListener('blur',this.hide);window.addEventListener('pagehide',this.hide);
  this.visibility=()=>{if(document.visibilityState==='hidden')this.hide();};document.addEventListener('visibilitychange',this.visibility);
  const poll=async()=>{
   if(this.stopped)return;
   if(document.visibilityState==='hidden'){this.timer=setTimeout(poll,500);return;}
   this.controller=new AbortController();
   try{const result=await this.request({clientId:this.clientId,cursor:this.cursor},{signal:this.controller.signal});if(!this.stopped)this.publish(result.peers??[]);}
   catch{if(!this.stopped)this.publish([]);}
   if(!this.stopped)this.timer=setTimeout(poll,120);
  };void poll();
 }
 stop(){this.stopped=true;clearTimeout(this.timer);this.controller?.abort();window.removeEventListener('blur',this.hide);window.removeEventListener('pagehide',this.hide);document.removeEventListener('visibilitychange',this.visibility);this.hide?.();}
}
