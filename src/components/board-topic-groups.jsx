import {useEffect,useState} from 'react';
import TopicDialog from './board-topic-dialog.jsx';
import BoardIcon from './board-icons.jsx';

export function GroupCreator({onCreate,busy,count}){
 const[open,setOpen]=useState(false),[title,setTitle]=useState('');
 return <><button type="button" className="board-action board-group-create" disabled={busy||count>=50} onClick={()=>setOpen(true)}><BoardIcon name="folder"/>Новая группа<BoardIcon name="plus"/></button>
 {open&&<TopicDialog title="Новая группа" busy={busy} onClose={()=>setOpen(false)}><p className="board-catalog-help">Объедините темы в папку: например, «Первая часть ОГЭ».</p><form className="board-group-form" onSubmit={async event=>{event.preventDefault();if(!busy&&title.trim()&&await onCreate(title.trim())){setTitle('');setOpen(false);}}}><label>Название группы<input autoFocus aria-label="Название новой группы" maxLength={80} required value={title} placeholder="Первая часть ОГЭ" disabled={busy} onChange={event=>setTitle(event.target.value)}/></label><div><button className="board-action" disabled={busy||!title.trim()}>Создать группу</button><button type="button" className="board-action" disabled={busy} onClick={()=>setOpen(false)}>Отмена</button></div></form></TopicDialog>}</>;
}
function TopicGroup({group,topics,activeId,first,editable,busy,renderTopic,onRename,onDelete}){
 const[expanded,setExpanded]=useState(topics.some(row=>row.id===activeId)||first||!topics.length),[editing,setEditing]=useState(false),[title,setTitle]=useState(group.title),[deleting,setDeleting]=useState(false);
 const active=topics.some(row=>row.id===activeId);
 useEffect(()=>{if(active)setExpanded(true);},[active,activeId]);
 return <section className={`board-topic-group${active?' has-active-board':''}`} aria-label={`Группа «${group.title}»`}>
  <div className="board-group-heading"><button type="button" className="board-group-toggle" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><BoardIcon name={expanded?'chevron-down':'chevron-right'}/><BoardIcon name="folder"/><span>{group.title}</span><small>{topics.length}</small></button>{editable&&<button type="button" className="board-topic-rename" aria-label={`Изменить группу «${group.title}»`} disabled={busy} onClick={()=>{setTitle(group.title);setEditing(!editing);setExpanded(true);}}><BoardIcon name="pen"/></button>}</div>
  {editing&&<form className="board-group-form" onSubmit={async event=>{event.preventDefault();if(!busy&&title.trim()&&await onRename(group.id,title.trim()))setEditing(false);}}><label>Название группы<input autoFocus aria-label="Новое название группы" maxLength={80} required disabled={busy} value={title} onChange={event=>setTitle(event.target.value)}/></label><div><button className="board-action" disabled={busy||!title.trim()}>Сохранить группу</button><button type="button" className="board-action" disabled={busy} onClick={()=>setEditing(false)}>Отмена</button><button type="button" className="board-action board-group-remove" disabled={busy} onClick={()=>setDeleting(true)}>Убрать группу</button></div></form>}
  {expanded&&<div className="board-group-contents">{topics.map(renderTopic)}{!topics.length&&<p className="board-group-empty">Пока нет досок</p>}</div>}
  {deleting&&<div className="board-dialog-backdrop"><section className="board-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-group-title"><h2 id="delete-group-title">Убрать группу «{group.title}»?</h2><p>Все её доски сохранятся в разделе «Без группы». Записи и PDF останутся на месте.</p><div><button type="button" className="board-action" autoFocus disabled={busy} onClick={()=>setDeleting(false)}>Оставить группу</button><button type="button" className="board-action" disabled={busy} onClick={async()=>{if(await onDelete(group.id))setDeleting(false);}}>Да, убрать группу</button></div></section></div>}
 </section>;
}
export function TopicGroups({groups,topics,activeId,editable,busy,renderTopic,onRename,onDelete}){
 if(!groups.length)return topics.map(renderTopic);
 const ungrouped=topics.filter(row=>row.id!=='main'&&!groups.some(group=>group.id===row.groupId));
 return <div className="board-topic-groups">{topics.filter(row=>row.id==='main').map(renderTopic)}{groups.map((group,index)=><TopicGroup key={group.id} group={group} topics={topics.filter(row=>row.id!=='main'&&row.groupId===group.id)} activeId={activeId} first={index===0} editable={editable} busy={busy} renderTopic={renderTopic} onRename={onRename} onDelete={onDelete}/>)}{ungrouped.length>0&&<section className="board-ungrouped" aria-label="Без группы"><h3>Без группы <span>{ungrouped.length}</span></h3>{ungrouped.map(renderTopic)}</section>}</div>;
}
