// Development presence is transient, just like the Go API's cursor store.
const entries=new Map();
export function exchangeCursors(room,actor,role,cursor,now=Date.now()){
 for(const[key,entry]of entries)if(now-entry.seen>4000)entries.delete(key);
 const key=room+'\0'+actor;
 if(!cursor)entries.delete(key);else if(entries.has(key)||entries.size<4096)entries.set(key,{room,actor,role,cursor,seen:now});
 return [...entries.values()].filter(entry=>entry.room===room&&entry.actor!==actor).map(({actor:id,role,cursor})=>({id,role,cursor}));
}
