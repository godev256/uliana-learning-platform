import {useCallback,useRef,useState} from 'react';
import BoardIcon from './board-icons.jsx';
import Whiteboard from './Whiteboard.jsx';
import {boardId} from './board-id.js';
import {preparePdfTopic} from './board-pdf-topic.js';

const CATALOG_KEY='uliana-whiteboard-topics-v1';
export function TopicPanel({topics,activeId,onSelect,onCreate,onRename,onReorder,onPdf,progress='',editable=true,busy=false,error=''}){
 const[name,setName]=useState(''),[renaming,setRenaming]=useState(null),[title,setTitle]=useState('');
 const[expanded,setExpanded]=useState(()=>!window.matchMedia('(max-width: 1024px), (any-pointer: coarse)').matches);
 const active=topics.find(topic=>topic.id===activeId),index=topics.findIndex(topic=>topic.id===activeId);
 async function create(event){event.preventDefault();if(await onCreate(name.trim()))setName('');}
 async function rename(event){event.preventDefault();if(!title.trim())return;if(await onRename(renaming,title.trim()))setRenaming(null);}
 return <aside className="board-topic-rail"><details open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary><BoardIcon name={expanded?"chevron-down":"chevron-right"}/>Доски по темам</summary>
  <nav aria-label="Доски по темам">{topics.map(topic=><div className="board-topic-row" key={topic.id}><button type="button" className={`board-topic-card${topic.id===activeId?' is-active':''}`} aria-pressed={topic.id===activeId} disabled={busy} onClick={()=>{setRenaming(null);onSelect(topic.id);}}><span className={topic.kind==='pdf'?'board-topic-pdf-icon':undefined} aria-hidden="true">{topic.kind==='pdf'?'PDF':<BoardIcon name="board"/>}</span><span>{topic.title}</span></button>{editable&&<button type="button" className="board-topic-rename" aria-label={`Переименовать ${topic.kind==='pdf'?'PDF':'доску'} «${topic.title}»`} title="Переименовать" disabled={busy} onClick={()=>{setTitle(topic.title);setRenaming(topic.id);}}><BoardIcon name="pen"/></button>}</div>)}</nav>
  {editable&&renaming&&<form className="board-topic-create" onSubmit={rename}><label>Название<input aria-label="Новое название доски" autoFocus onFocus={event=>event.target.select()} maxLength={80} required value={title} disabled={busy} onChange={e=>setTitle(e.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setRenaming(null);}}}/></label><button className="board-action" disabled={busy||!title.trim()}>Сохранить название</button><button type="button" className="board-action" disabled={busy} onClick={()=>setRenaming(null)}>Отмена</button></form>}

  {editable&&<><form className="board-topic-create" onSubmit={create}><label>Новая тема<input aria-label="Название новой доски" maxLength={80} required value={name} onChange={e=>setName(e.target.value)} placeholder="Задание 18 ОГЭ" disabled={busy}/></label><button className="board-action" disabled={busy||!name.trim()||topics.length>=100} aria-label="+ Создать доску"><BoardIcon name="plus"/><span>Создать доску</span></button></form>
  {onPdf&&<label className={`board-topic-pdf-upload${busy?' is-disabled':''}`}><BoardIcon name="plus"/><span>Добавить PDF</span><input type="file" aria-label="PDF как доска" accept="application/pdf,.pdf" disabled={busy||topics.length>=100} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)onPdf(file);}}/></label>}
  {progress&&<p className="board-topic-progress" role="status">{progress}</p>}
  {active&&<div className="board-topic-management"><button type="button" className="board-action" disabled={busy} onClick={()=>{setTitle(active.title);setRenaming(activeId);}}>Переименовать</button><div><button type="button" className="board-action" aria-label="Поднять доску" disabled={busy||index<=0} onClick={()=>onReorder(index,index-1)}><BoardIcon name="arrow-up"/></button><button type="button" className="board-action" aria-label="Опустить доску" disabled={busy||index>=topics.length-1} onClick={()=>onReorder(index,index+1)}><BoardIcon name="arrow-down"/></button></div></div>}</>}

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
 function reorder(from,to){const rows=[...topics];[rows[from],rows[to]]=[rows[to],rows[from]];catalog(rows);}
 return <Whiteboard key={activeId} pdfMode={topics.find(row=>row.id===activeId)?.kind==='pdf'} storageKey={notebookKey(activeId)} onNotebookChange={changed} topicsPanel={<TopicPanel topics={topics} activeId={activeId} onSelect={select} onCreate={create} onRename={(id,title)=>catalog(topics.map(row=>row.id===id?{...row,title}:row))} onReorder={reorder} onPdf={addPdf} busy={busy} progress={progress} error={error}/>}/>;
}
