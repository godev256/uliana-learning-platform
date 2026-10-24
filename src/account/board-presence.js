import {boardId} from '../components/board-id.js';
const empty=[];
export const noPresence={subscribe:()=>()=>{},getSnapshot:()=>empty,move:()=>{}};
export class BoardPresence {
 constructor(request,live={}){this.request=request;this.live=live;this.clientId=boardId();this.cursor=null;this.peers=empty;this.listeners=new Set();this.stopped=false;this.livePeers=new Map();}
 subscribe=listener=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 getSnapshot=()=>this.peers;
 move=cursor=>{clearTimeout(this.touchTimer);this.cursor=cursor;this.sendSoon();};
 releaseTouch=()=>{clearTimeout(this.touchTimer);this.touchTimer=setTimeout(()=>this.move(null),700);};
 publish(peers){
  const next=peers.filter(peer=>peer&&typeof peer.id==='string'&&['teacher','student'].includes(peer.role)&&Number.isInteger(peer.cursor?.page)&&Number.isFinite(peer.cursor.x)&&Number.isFinite(peer.cursor.y)).sort((a,b)=>a.id.localeCompare(b.id));
  if(JSON.stringify(next)===JSON.stringify(this.peers))return;this.peers=next;for(const listener of this.listeners)listener();
 }
 sendSoon(){if(this.socket?.readyState!==1||this.sendTimer)return;this.sendTimer=setTimeout(()=>{this.sendTimer=null;this.sendCursor();},32);}
 sendCursor(){if(this.socket?.readyState===1&&this.socket.bufferedAmount<16384)this.socket.send(JSON.stringify({type:'cursor',cursor:this.cursor}));}
 connect(){
  if(this.stopped||!this.live.studentId||typeof WebSocket==='undefined')return;
  const url=new URL('/api/board/live',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.search=new URLSearchParams({studentId:this.live.studentId,topicId:this.live.topicId,clientId:this.clientId});
  let socket;try{socket=new WebSocket(url);}catch{this.reconnect=setTimeout(()=>this.connect(),5000);return;}this.socket=socket;
  socket.onopen=()=>{this.controller?.abort();this.sendCursor();};
  socket.onmessage=event=>{if(this.stopped||this.socket!==socket)return;try{
   const message=JSON.parse(event.data);
   if(message.type==='ready'){this.livePeers.clear();for(const peer of message.peers??[])this.livePeers.set(peer.id,{...peer,seen:performance.now()});this.publish([...this.livePeers.values()]);this.live.onReady?.(message);}
   else if(message.type==='cursor'&&!message.id.endsWith(':'+this.clientId)){if(message.cursor)this.livePeers.set(message.id,{id:message.id,role:message.role,cursor:message.cursor,seen:performance.now()});else this.livePeers.delete(message.id);this.publish([...this.livePeers.values()].map(({seen,...peer})=>peer));}
   else if(message.type==='commit')void Promise.resolve(this.live.onCommit?.(message)).catch(()=>this.live.onReady?.());
  }catch{this.live.onReady?.();}};
  socket.onclose=()=>{if(this.socket!==socket)return;this.socket=null;this.livePeers.clear();this.publish([]);if(!this.stopped)this.reconnect=setTimeout(()=>this.connect(),2500);};
 }
 start(){
  this.hide=()=>{clearTimeout(this.touchTimer);this.cursor=null;this.publish([]);if(this.socket?.readyState===1)this.sendCursor();else void this.request({clientId:this.clientId,cursor:null},{keepalive:true}).catch(()=>{});};
  window.addEventListener('blur',this.hide);window.addEventListener('pagehide',this.hide);
  this.visibility=()=>{if(document.visibilityState==='hidden')this.hide();else{this.live.onReady?.();this.sendSoon();}};document.addEventListener('visibilitychange',this.visibility);
  const poll=async()=>{
   if(this.stopped)return;
   if(document.visibilityState==='hidden'||this.socket?.readyState===1){this.timer=setTimeout(poll,250);return;}
   this.controller=new AbortController();
   try{const result=await this.request({clientId:this.clientId,cursor:this.cursor},{signal:this.controller.signal});if(!this.stopped&&this.socket?.readyState!==1)this.publish(result.peers??[]);}
   catch{if(!this.stopped&&this.socket?.readyState!==1)this.publish([]);}
   if(!this.stopped)this.timer=setTimeout(poll,120);
  };this.connect();void poll();
  this.heartbeat=setInterval(()=>{if(this.socket?.readyState!==1)return;this.sendCursor();const now=performance.now();for(const [id,peer]of this.livePeers)if(now-peer.seen>4000)this.livePeers.delete(id);this.publish([...this.livePeers.values()].map(({seen,...peer})=>peer));},1000);
 }
 stop(){this.stopped=true;clearTimeout(this.timer);clearTimeout(this.sendTimer);clearTimeout(this.reconnect);clearInterval(this.heartbeat);this.controller?.abort();window.removeEventListener('blur',this.hide);window.removeEventListener('pagehide',this.hide);document.removeEventListener('visibilitychange',this.visibility);this.hide?.();this.socket?.close();}
}
