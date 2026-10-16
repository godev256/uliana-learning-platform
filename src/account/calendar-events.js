const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const fromKey=value=>new Date(`${value}T12:00:00`);
const keyOf=event=>`${event.originalDate}T${event.originalTime}`;

export function calendarEvents(schedule,changes,month){
 const start=fromKey(`${month}-01`),events=[];
 for(let day=new Date(start);day.getMonth()===start.getMonth();day.setDate(day.getDate()+1)){
  const date=dateKey(day),weekday=(day.getDay()+6)%7;
  for(const row of schedule.filter(row=>row.day===weekday)){
   const original={originalDate:date,originalTime:row.time,date,time:row.time,duration:row.duration};
   if(!changes.some(change=>keyOf(change)===keyOf(original)))events.push(original);
  }
 }
 for(const change of changes)if(change.date.startsWith(month))events.push({...change,moved:true});
 return events.sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

