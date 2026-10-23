import {useCallback,useRef,useState} from 'react';
import BoardIcon from './board-icons.jsx';
import {GroupCreator,TopicGroups} from './board-topic-groups.jsx';
import Whiteboard from './Whiteboard.jsx';
import {boardId} from './board-id.js';
import {preparePdfTopic} from './board-pdf-topic.js';

const CATALOG_KEY='uliana-whiteboard-topics-v1';
function hasLocalNotes(){try{return JSON.parse(localStorage.getItem('uliana-whiteboard-v2'))?.items?.length>0||JSON.parse(localStorage.getItem(CATALOG_KEY))?.some(row=>row.id!=='main');}catch{return false;}}
export function TopicPanel({topics,activeId,onSelect,onCreate,onRename,onReorder,onDelete,onRestore,groups=[],onCreateGroup,onRenameGroup,onDeleteGroup,onMove,trash=[],onPdf,progress='',editable=true,busy=false,error=''}){
 const[name,setName]=useState(''),[renaming,setRenaming]=useState(null),[title,setTitle]=useState(''),[deleting,setDeleting]=useState(null);
 const[expanded,setExpanded]=useState(()=>!window.matchMedia('(max-width: 1024px), (any-pointer: coarse)').matches);
 const [newGroupId,setNewGroupId]=useState(null),createInput=useRef(null);
 const active=topics.find(topic=>topic.id===activeId),index=topics.findIndex(topic=>topic.id===activeId);
 const orderPeers=groups.length?topics.filter(topic=>topic.id!=='main'&&(topic.groupId||'')===(active?.groupId||'')):topics,peerIndex=orderPeers.findIndex(topic=>topic.id===activeId);
 const requestedGroup=newGroupId??active?.groupId??'',createGroup=groups.some(group=>group.id===requestedGroup)?requestedGroup:'';
 async function create(event){event.preventDefault();if(await onCreate(name.trim(),createGroup))setName('');}
 async function rename(event){event.preventDefault();if(busy||!title.trim())return;if(await onRename(renaming,title.trim()))setRenaming(null);}
 const renderTopic=topic=><div className="board-topic-row" key={topic.id}><button type="button" className={`board-topic-card${topic.id===activeId?' is-active':''}`} aria-pressed={topic.id===activeId} disabled={busy} onClick={()=>{setRenaming(null);onSelect(topic.id);if(window.matchMedia('(max-width:1024px), (any-pointer:coarse)').matches)setExpanded(false);}}><span className={topic.kind==='pdf'?'board-topic-pdf-icon':undefined} aria-hidden="true">{topic.kind==='pdf'?'PDF':<BoardIcon name="board"/>}</span><span>{topic.title}</span></button>{editable&&<button type="button" className="board-topic-rename" aria-label={`Переименовать ${topic.kind==='pdf'?'PDF':'доску'} «${topic.title}»`} title="Переименовать" disabled={busy} onClick={()=>{setTitle(topic.title);setRenaming(topic.id);}}><BoardIcon name="pen"/></button>}{editable&&topic.id===activeId&&topic.id!=='main'&&onDelete&&<button type="button" className="board-topic-delete" disabled={busy} onClick={()=>setDeleting(topic)}><BoardIcon name="trash"/>Удалить доску</button>}</div>;
 return <aside className="board-topic-rail"><details open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary><BoardIcon name={expanded?"chevron-down":"chevron-right"}/>{editable&&onCreateGroup?'Группы и доски':'Доски по темам'}</summary>
  {editable&&onCreateGroup&&<GroupCreator onCreate={onCreateGroup} busy={busy} count={groups.length}/>}
  <nav aria-label="Доски по темам"><TopicGroups groups={groups} topics={topics} activeId={activeId} editable={editable} busy={busy} renderTopic={renderTopic} onRename={onRenameGroup} onDelete={onDeleteGroup} onChoose={groupId=>{setNewGroupId(groupId);createInput.current?.focus();}}/></nav>
  {editable&&renaming&&<form className="board-topic-create" onSubmit={rename}><label>Название<input aria-label="Новое название доски" enterKeyHint="done" autoFocus onFocus={event=>event.target.select()} maxLength={80} required value={title} disabled={busy} onChange={e=>setTitle(e.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setRenaming(null);}}}/></label><small className="board-topic-rename-hint">Return — сохранить название</small><button className="board-action" disabled={busy||!title.trim()}>Сохранить название</button><button type="button" className="board-action" disabled={busy} onClick={()=>setRenaming(null)}>Отмена</button></form>}

  {editable&&<><form className="board-topic-create" onSubmit={create}>{onCreateGroup&&groups.length>0&&<label className="board-group-field">В группу<select aria-label="Группа новой доски" disabled={busy} value={createGroup} onChange={event=>setNewGroupId(event.target.value)}><option value="">Без группы</option>{groups.map(group=><option key={group.id} value={group.id}>{group.title}</option>)}</select></label>}<label>Новая тема<input ref={createInput} aria-label="Название новой доски" maxLength={80} required value={name} onChange={e=>setName(e.target.value)} placeholder="Задание 18 ОГЭ" disabled={busy}/></label><button className="board-action" disabled={busy||!name.trim()||topics.length>=100} aria-label="+ Создать доску"><BoardIcon name="plus"/><span>Создать доску</span></button></form>
  {onPdf&&<label className={`board-topic-pdf-upload${busy?' is-disabled':''}`}><BoardIcon name="plus"/><span>Добавить PDF</span><input type="file" aria-label="PDF как доска" accept="application/pdf,.pdf" disabled={busy||topics.length>=100} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)onPdf(file,createGroup);}}/></label>}
  {progress&&<p className="board-topic-progress" role="status">{progress}</p>}
  {active&&<div className="board-topic-management"><button type="button" className="board-action" disabled={busy} onClick={()=>{setTitle(active.title);setRenaming(activeId);}}>Переименовать</button><div><button type="button" className="board-action" aria-label="Поднять доску" disabled={busy||peerIndex<=0} onClick={()=>onReorder(index,topics.findIndex(topic=>topic.id===orderPeers[peerIndex-1]?.id))}><BoardIcon name="arrow-up"/></button><button type="button" className="board-action" aria-label="Опустить доску" disabled={busy||peerIndex<0||peerIndex>=orderPeers.length-1} onClick={()=>onReorder(index,topics.findIndex(topic=>topic.id===orderPeers[peerIndex+1]?.id))}><BoardIcon name="arrow-down"/></button></div></div>}</>}

  {editable&&onMove&&active&&active.id!=='main'&&groups.length>0&&<label className="board-topic-move board-group-field">Группа этой доски<select aria-label="Группа этой доски" disabled={busy} value={active.groupId||''} onChange={event=>onMove(active.id,event.target.value)}><option value="">Без группы</option>{groups.map(group=><option key={group.id} value={group.id}>{group.title}</option>)}</select></label>}
  {editable&&onRestore&&<details className="board-trash"><summary><BoardIcon name="trash"/>Корзина <span>{trash.length}</span></summary><p>Доски хранятся здесь 7 дней, затем удаляются автоматически.</p>{!trash.length?<p>Корзина пуста.</p>:<ul>{trash.map(topic=><li key={topic.id}><strong>{topic.title}</strong><small>Удалится {new Date(topic.expiresAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small><button type="button" className="board-action" aria-label={`Восстановить доску «${topic.title}»`} disabled={busy} onClick={()=>onRestore(topic.id)}>Восстановить</button></li>)}</ul>}</details>}
  {deleting&&<div className="board-dialog-backdrop" onKeyDown={event=>{if(event.key==='Escape'&&!busy){event.stopPropagation();setDeleting(null);}}}><section className="board-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-topic-title"><h2 id="delete-topic-title">{onRestore?'Переместить в корзину':'Удалить доску'} «{deleting.title}»?</h2><p>{onRestore?'Доску со всеми листами и записями можно будет восстановить в течение 7 дней. Затем она удалится автоматически.':'Все листы и записи на этой доске будут удалены. Остальные доски сохранятся.'}</p><div><button type="button" className="board-action" autoFocus disabled={busy} onClick={()=>setDeleting(null)}>Оставить доску</button><button type="button" className="board-action board-topic-delete-confirm" disabled={busy} onClick={async()=>{if(await onDelete(deleting.id))setDeleting(null);}}>{onRestore?'В корзину':'Да, удалить доску'}</button></div>{error&&<p role="alert">{error}</p>}</section></div>}
  {editable&&location.pathname.replace(/\/$/,'')==='/board'&&hasLocalNotes()&&<a className="board-topic-local-backup" href="/board/local">Старые записи в этом браузере</a>}
  {error&&<p className="board-topic-error" role="alert">{error}</p>}
 </details></aside>;
}
function readTopics(){try{const rows=JSON.parse(localStorage.getItem(CATALOG_KEY));if(Array.isArray(rows)){const valid=rows.filter(row=>row&&typeof row.id==='string'&&/^(main|[a-zA-Z0-9-]{16,80})$/.test(row.id)&&typeof row.title==='string'&&row.title.trim()).slice(0,100);if(valid.some(row=>row.id==='main')&&new Set(valid.map(row=>row.id)).size===valid.length)return valid;}}catch{}return [{id:'main',title:'Текущий урок'}];}
const notebookKey=id=>id==='main'?'uliana-whiteboard-v2':`uliana-whiteboard-topic:${id}`;
export default function LocalTopicBoards(){
 const[topics,setTopics]=useState(readTopics),[activeId,setActiveId]=useState('main'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const notebook=useRef(null),changed=useCallback(book=>{notebook.current=book;},[]);
 function preserve(){try{if(notebook.current)localStorage.setItem(notebookKey(activeId),JSON.stringify(notebook.current));setError('');return true;}catch{setError('Не удалось сохранить доску в браузере. Скачайте PDF перед переключением.');return false;}}
 function catalog(rows){try{localStorage.setItem(CATALOG_KEY,JSON.stringify(rows));setTopics(rows);setError('');return true;}catch{setError('Не удалось сохранить список досок в браузере.');return false;}}
 function select(id){if(busy||id===activeId||!preserve())return;notebook.current=null;setActiveId(id);}
 function create(title){if(!title||topics.length>=100||!preserve())return false;const id=boardId();if(!catalog([...topics,{id,title}]))return false;notebook.current=null;setActiveId(id);return true;}
 async function addPdf(file){
  if(busy||topics.length>=100||!preserve())return;setBusy(true);setError('');
  try{const {document,notebook:book}=await preparePdfTopic(file,setProgress),id=boardId(),title=file.name.replace(/\.pdf$/i,'').slice(0,80)||'Рабочий лист';if(!preserve())return;localStorage.setItem(notebookKey(id),JSON.stringify(book));if(!catalog([...topics,{id,title,kind:'pdf',document:{assetId:document.assetId,name:document.name,pageCount:document.pageCount}}]))return;notebook.current=null;setActiveId(id);}catch(err){setError(err.message);}finally{setBusy(false);setProgress('');}
 }
 function remove(id){
  if(busy||id==='main'||!topics.some(row=>row.id===id)||!preserve())return false;
  if(!catalog(topics.filter(row=>row.id!==id)))return false;
  try{localStorage.removeItem(notebookKey(id));}catch{}
  if(id===activeId){notebook.current=null;setActiveId('main');}return true;
 }
 function reorder(from,to){const rows=[...topics];[rows[from],rows[to]]=[rows[to],rows[from]];catalog(rows);}
 return <Whiteboard key={activeId} pdfMode={topics.find(row=>row.id===activeId)?.kind==='pdf'} storageKey={notebookKey(activeId)} onNotebookChange={changed} topicsPanel={<TopicPanel topics={topics} activeId={activeId} onSelect={select} onCreate={create} onRename={(id,title)=>catalog(topics.map(row=>row.id===id?{...row,title}:row))} onReorder={reorder} onDelete={remove} onPdf={addPdf} busy={busy} progress={progress} error={error}/>}/>;
}
