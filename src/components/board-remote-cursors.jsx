import {useSyncExternalStore} from 'react';
import {noPresence} from '../account/board-presence.js';
export default function RemoteCursors({presence=noPresence,page,scale}){
 const peers=useSyncExternalStore(presence.subscribe,presence.getSnapshot,presence.getSnapshot);
 return peers.filter(peer=>peer.cursor.page===page).map(peer=>{
  const teacher=peer.role==='teacher',color=teacher?'#2f6958':'#a45c40',label=teacher?'Преподаватель':'Ученик';
  return <g key={peer.id} data-remote-cursor={peer.role} aria-label={`Курсор: ${label}`} pointerEvents="none" transform={`translate(${peer.cursor.x} ${peer.cursor.y}) scale(${scale})`}>
   <path d="M0 0 L4 19 L9 13 L15 13 Z" fill={color} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
   <rect x="13" y="17" width={teacher?110:68} height="23" rx="7" fill={color}/>
   <text x="20" y="32" fill="#fff" fontFamily="Golos Text, Arial, sans-serif" fontSize="11">{label}</text>
  </g>;
 });
}
