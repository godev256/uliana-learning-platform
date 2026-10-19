import BoardIcon from "../components/board-icons.jsx";
import {useState} from 'react';
import {calendarEvents} from './calendar-events.js';

const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const fromKey=value=>new Date(`${value}T12:00:00`);
const describe=value=>fromKey(value).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
const keyOf=event=>`${event.originalDate}T${event.originalTime}`;

const days=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
function FixedSchedule({schedule,teacher,onChange}){
 const update=(index,key,value)=>onChange(schedule.map((row,i)=>i===index?{...row,[key]:value}:row));
 return <section className="account-calendar-schedule" aria-label="Постоянное расписание"><h4>Постоянное расписание</h4>
  {!schedule.length&&<p>Преподаватель пока не добавил расписание.</p>}
  <ul>{[...schedule].sort((a,b)=>a.day-b.day||a.time.localeCompare(b.time)).map((row,index)=><li key={index}><span>{days[row.day]}</span><strong>{row.time}</strong></li>)}</ul>
  {teacher&&<details className="account-schedule-editor"><summary>Изменить расписание</summary>
   {schedule.map((row,index)=><div className="account-schedule-row" key={index}><label>День<select aria-label={`День занятия ${index+1}`} value={row.day} onChange={e=>update(index,'day',Number(e.target.value))}>{days.map((day,i)=><option key={day} value={i}>{day}</option>)}</select></label><label>Начало<input aria-label={`Время занятия ${index+1}`} type="time" required value={row.time} onChange={e=>update(index,'time',e.target.value)}/></label><label>Минут<input aria-label={`Длительность занятия ${index+1}`} type="number" min="15" max="180" required value={row.duration} onChange={e=>update(index,'duration',Number(e.target.value))}/></label><button type="button" className="account-icon" aria-label={`Убрать время ${index+1}`} onClick={()=>onChange(schedule.filter((_,i)=>i!==index))}>×</button></div>)}
   <button className="account-secondary" type="button" disabled={schedule.length>=14} onClick={()=>onChange([...schedule,{day:0,time:'16:00',duration:60}])}>+ Добавить время</button>
   <small>Затем нажмите «Сохранить изменения».</small>
  </details>}
 </section>;
}

export default function LessonCalendar({schedule,changes=[],teacher,onChange,onScheduleChange,today}){
 const[month,setMonth]=useState(()=>today.slice(0,7)),[selected,setSelected]=useState(today),[editing,setEditing]=useState(null);
 const events=calendarEvents(schedule,changes,month),first=fromKey(`${month}-01`),offset=(first.getDay()+6)%7,count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const selectedEvents=events.filter(event=>event.date===selected);
 function navigate(step){const date=fromKey(`${month}-01`);date.setMonth(date.getMonth()+step);const value=dateKey(date);setMonth(value.slice(0,7));setSelected(value);setEditing(null);}
 function apply(){
  const {moved,...change}=editing;
  const next=changes.filter(row=>keyOf(row)!==keyOf(change));
  // A return to the original date/time still retains an explicit duration change.
  onChange([...next,change]);setMonth(change.date.slice(0,7));setSelected(change.date);setEditing(null);
 }
 return <section className="account-card account-calendar" aria-label="Календарь занятий">
  <div className="account-calendar-heading"><div><h2>Календарь занятий</h2><p>Московское время{teacher?' · Выберите день и перенесите нужный урок. Изменения появятся у ученика после сохранения.':''}</p></div><div className="account-calendar-navigation"><button type="button" className="account-secondary" aria-label="Предыдущий месяц календаря" onClick={()=>navigate(-1)}><BoardIcon name="chevron-left"/></button><strong aria-live="polite">{first.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</strong><button type="button" className="account-secondary" aria-label="Следующий месяц календаря" onClick={()=>navigate(1)}><BoardIcon name="chevron-right"/></button></div></div>
  <div className="account-calendar-layout"><div><div className="account-calendar-week" aria-hidden="true">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=><span key={day}>{day}</span>)}</div><div className="account-calendar-grid">{Array.from({length:offset},(_,i)=><span key={`empty-${i}`}/>)}{Array.from({length:count},(_,i)=>{
   const date=`${month}-${String(i+1).padStart(2,'0')}`,lessons=events.filter(event=>event.date===date);
   return <button type="button" key={date} aria-label={`${describe(date)}${lessons.length?`, занятий: ${lessons.length}`:''}`} aria-pressed={selected===date} aria-current={date===today?'date':undefined} className={`account-calendar-day${lessons.length?' has-lessons':''}${selected===date?' is-selected':''}${date===today?' is-today':''}`} onClick={()=>{setSelected(date);setEditing(null);}}><span>{i+1}</span><span className="account-calendar-times">{lessons.slice(0,2).map((event,index)=><small className={event.moved?'is-moved':''} key={index}>{event.time}{event.moved?' ↪':''}</small>)}{lessons.length>2&&<small>+{lessons.length-2}</small>}</span></button>;
  })}</div><div className="account-calendar-legend"><span>● По расписанию</span><span>↪ Перенесённый урок</span></div></div>
  <div className="account-calendar-details"><h3>{describe(selected)}</h3>{!selectedEvents.length&&<p>В этот день занятий нет.</p>}{selectedEvents.map(event=><article className="account-calendar-event" key={keyOf(event)}><strong>{event.time} · {event.duration} минут</strong>{event.moved&&<p>Перенос с {describe(event.originalDate)}, {event.originalTime}</p>}{teacher&&<div className="account-calendar-actions"><button type="button" className="account-secondary" onClick={()=>setEditing({...event})}>Перенести урок</button>{event.moved&&<button type="button" className="account-text-button" onClick={()=>{onChange(changes.filter(row=>keyOf(row)!==keyOf(event)));setEditing(null);}}>Вернуть по расписанию</button>}</div>}</article>)}
  {teacher&&editing&&<div className="account-calendar-editor"><h4>Перенос урока</h4><label>Новая дата<input aria-label="Новая дата занятия" type="date" required value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})}/></label><label>Новое время<input aria-label="Новое время занятия" type="time" required value={editing.time} onChange={e=>setEditing({...editing,time:e.target.value})}/></label><label>Длительность, минут<input aria-label="Длительность переносимого занятия" type="number" min="15" max="180" required value={editing.duration} onChange={e=>setEditing({...editing,duration:Number(e.target.value)})}/></label><div className="account-calendar-actions"><button type="button" className="account-primary" disabled={!editing.date||!editing.time||editing.duration<15||editing.duration>180} onClick={apply}>Применить перенос</button><button type="button" className="account-secondary" onClick={()=>setEditing(null)}>Отмена</button></div><small>Затем нажмите «Сохранить изменения».</small></div>}
  <FixedSchedule schedule={schedule} teacher={teacher} onChange={onScheduleChange}/>
  </div></div>
 </section>;
}
