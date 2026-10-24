import {WebSocketServer} from 'ws';
import accounts from '../server/accounts.js';
import {exchangeCursors} from '../server/board-presence.js';
import {liveBroadcast,liveJoin} from '../server/board-live.js';
function readAccount(req,query){return new Promise(resolve=>{const response={statusCode:200,setHeader(){},end(body){resolve({status:this.statusCode,...JSON.parse(body)});}};void accounts({method:'GET',url:'/api/account?'+new URLSearchParams(query),headers:req.headers,socket:req.socket},response);});}
export function accountsApi(){return {name:'accounts-api',configureServer(server){
 server.middlewares.use((req,res,next)=>{if(req.url.split('?')[0]!=='/api/account')return next();void accounts(req,res);});
 const live=new WebSocketServer({noServer:true,maxPayload:4096});
 server.httpServer?.on('upgrade',async(req,socket,head)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname!=='/api/board/live')return;
  const reject=()=>socket.destroy();let origin;try{origin=new URL(req.headers.origin).host;}catch{return reject();}if(origin!==req.headers.host)return reject();
  const clientId=url.searchParams.get('clientId'),studentId=url.searchParams.get('studentId'),topicId=url.searchParams.get('topicId')||'main';if(!/^[a-zA-Z0-9_-]{16,80}$/.test(clientId??''))return reject();
  const [session,board]=await Promise.all([readAccount(req,{action:'session'}),readAccount(req,{action:'board',studentId,topicId})]);if(!session.user||board.status!==200)return reject();
  if(socket.destroyed)return;
  live.handleUpgrade(req,socket,head,ws=>{
   const room=board.student.id+':'+topicId,actor=session.user.id+':'+clientId,role=session.user.role,leave=liveJoin(room,ws);
   ws.send(JSON.stringify({type:'ready',revision:board.revision,peers:exchangeCursors(room,actor,role,null)}));
   let count=0,window=Date.now();ws.on('message',data=>{try{if(Date.now()-window>=1000){count=0;window=Date.now();}if(++count>120)throw Error();const message=JSON.parse(data),c=message.cursor;if(message.type!=='cursor'||c!==null&&(!Number.isInteger(c?.page)||c.page<0||c.page>=100||!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.x>1680||c.y<0||c.y>2376))throw Error();exchangeCursors(room,actor,role,c);liveBroadcast(room,{type:'cursor',id:actor,role,cursor:c});}catch{ws.close(1008);}});
   const timer=setInterval(async()=>{const fresh=await readAccount(req,{action:'board',studentId,topicId});if(fresh.status!==200)ws.terminate();else ws.ping();},15000);
   ws.on('error',()=>ws.terminate());ws.on('close',()=>{clearInterval(timer);leave();exchangeCursors(room,actor,role,null);liveBroadcast(room,{type:'cursor',id:actor,role,cursor:null});});
  });
 });
 server.httpServer?.once('close',()=>{for(const ws of live.clients)ws.terminate();live.close();});
}};}
