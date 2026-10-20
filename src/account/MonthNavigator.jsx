import {useEffect, useId, useRef, useState} from 'react';
import BoardIcon from '../components/board-icons.jsx';

const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export function shiftMonth(value, direction) {
 const [year,month]=value.split('-').map(Number);
 const date=new Date(year,month-1+direction,1);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

export default function MonthNavigator({value,onChange,label,currentMonth,markedMonths=[]}) {
 const [open,setOpen]=useState(false),[year,setYear]=useState(Number(value.slice(0,4)));
 const root=useRef(null),trigger=useRef(null),selected=useRef(null),id=useId();
 const title=`${months[Number(value.slice(5,7))-1]} ${value.slice(0,4)}`;
 useEffect(()=>{
  if(!open)return;
  selected.current?.focus();
  const dismiss=event=>{
   if(event.type==='keydown'){
    if(event.key!=='Escape')return;
    event.stopPropagation();trigger.current?.focus();
   }else if(root.current?.contains(event.target))return;
   setOpen(false);
  };
  document.addEventListener('pointerdown',dismiss);
  document.addEventListener('keydown',dismiss);
  document.addEventListener('focusin',dismiss);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',dismiss);document.removeEventListener('focusin',dismiss);};
 },[open]);
 function choose(month){onChange(month);setOpen(false);trigger.current?.focus();}
 return <div className="account-period" ref={root} role="group" aria-label={`Период ${label}`}>
  <button className="account-period-arrow" type="button" aria-label={`Предыдущий месяц ${label}`} onClick={()=>{setOpen(false);onChange(shiftMonth(value,-1));}}><BoardIcon name="chevron-left"/></button>
  <button className="account-period-trigger" type="button" ref={trigger} aria-label={`Выбрать месяц ${label}: ${title}`} aria-expanded={open} aria-controls={open?id:undefined} aria-haspopup="dialog" onClick={()=>{setYear(Number(value.slice(0,4)));setOpen(!open);}}><span aria-live="polite">{title}</span><BoardIcon name="chevron-down"/></button>
  <button className="account-period-arrow" type="button" aria-label={`Следующий месяц ${label}`} onClick={()=>{setOpen(false);onChange(shiftMonth(value,1));}}><BoardIcon name="chevron-right"/></button>
  {open&&<div className="account-period-popover" role="dialog" aria-label={`Выбор периода ${label}`} id={id}>
   <div className="account-period-year"><button type="button" className="account-period-arrow" aria-label={`Предыдущий год ${label}`} onClick={()=>setYear(year-1)}><BoardIcon name="chevron-left"/></button><strong aria-live="polite">{year}</strong><button type="button" className="account-period-arrow" aria-label={`Следующий год ${label}`} onClick={()=>setYear(year+1)}><BoardIcon name="chevron-right"/></button></div>
   <div className="account-period-months">{months.map((name,index)=>{const key=`${year}-${String(index+1).padStart(2,'0')}`;return <button key={name} type="button" ref={key===value?selected:undefined} aria-label={`${name} ${year}`} aria-pressed={key===value} className={key===value?'is-selected':''} onClick={()=>choose(key)}>{name}{markedMonths.includes(key)&&<span className="account-period-dot" aria-hidden="true"/>}</button>;})}</div>
   <button className="account-period-today" type="button" onClick={()=>choose(currentMonth)}>Этот месяц<BoardIcon name="arrow-right"/></button>
  </div>}
 </div>;
}
