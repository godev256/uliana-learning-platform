import {useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import BoardIcon from './board-icons.jsx';
export default function TopicDialog({title,onClose,busy,children}){
 const id=useId(),dialog=useRef(null),before=useRef(document.activeElement),latest=useRef({onClose,busy});
 latest.current={onClose,busy};
 useEffect(()=>{
  (dialog.current.querySelector('input:not([hidden])')||dialog.current.querySelector('select,button'))?.focus();
  const key=event=>{
   if(event.key==='Escape'&&!latest.current.busy){event.preventDefault();event.stopPropagation();latest.current.onClose();}
   if(event.key==='Tab'){
    const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled):not([hidden]),select:not(:disabled)')].filter(n=>n.getClientRects().length),first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('keydown',key,true);if(before.current?.isConnected)before.current.focus();};
 },[]);
 return createPortal(<div className="board-dialog-backdrop board-catalog-backdrop" onClick={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}><section ref={dialog} className="board-dialog board-catalog-dialog" role="dialog" aria-modal="true" aria-labelledby={id}><header><h2 id={id}>{title}</h2><button type="button" className="board-action" aria-label="Закрыть окно" disabled={busy} onClick={onClose}><BoardIcon name="close"/></button></header>{children}</section></div>,document.body);
}
