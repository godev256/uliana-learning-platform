import {useEffect,useRef,useSyncExternalStore} from 'react';
import {noPresence} from '../account/board-presence.js';
function Cursor({peer,scale}){
 const node=useRef(null),position=useRef({...peer.cursor}),animation=useRef(null),currentScale=useRef(scale);currentScale.current=scale;
 useEffect(()=>{
  cancelAnimationFrame(animation.current);const from={...position.current},to=peer.cursor,start=performance.now();
  const duration=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:70;
  const frame=now=>{const t=duration?Math.min(1,(now-start)/duration):1;position.current={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};node.current?.setAttribute('transform',`translate(${position.current.x} ${position.current.y}) scale(${currentScale.current})`);if(t<1)animation.current=requestAnimationFrame(frame);};
  animation.current=requestAnimationFrame(frame);return()=>cancelAnimationFrame(animation.current);
 },[peer.cursor.x,peer.cursor.y,scale]);
 const teacher=peer.role==='teacher',color=teacher?'#2f6958':'#a45c40',label=teacher?'Преподаватель':'Ученик';
 return <g ref={node} data-remote-cursor={peer.role} aria-label={`Курсор: ${label}`} pointerEvents="none" transform={`translate(${position.current.x} ${position.current.y}) scale(${scale})`}>
  <path d="M0 0 L4 19 L9 13 L15 13 Z" fill={color} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
  <rect x="13" y="17" width={teacher?110:68} height="23" rx="7" fill={color}/>
  <text x="20" y="32" fill="#fff" fontFamily="Golos Text, Arial, sans-serif" fontSize="11">{label}</text>
 </g>;
}
export default function RemoteCursors({presence=noPresence,page,scale}){
 const peers=useSyncExternalStore(presence.subscribe,presence.getSnapshot,presence.getSnapshot);
 return peers.filter(peer=>peer.cursor.page===page).map(peer=><Cursor key={peer.id} peer={peer} scale={scale}/>);
}
