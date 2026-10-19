import BoardIcon from "../components/board-icons.jsx";
import {useEffect,useState} from 'react';
import {boardId} from '../components/board-id.js';
import {receiveAsset,sendAsset} from './client.js';

const MAX_PDF_SIZE=20*1024*1024;
export default function LessonNotes({attachment,studentId,teacher,index,onChange,onUploading}){
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(null);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
 async function upload(file){
  if(!file)return;
  setError('');setBusy(true);onUploading(1);
  try{
   if(!/\.pdf$/i.test(file.name)||await file.slice(0,5).text()!=='%PDF-')throw new Error('Выберите конспект в формате PDF.');
   if(file.size>MAX_PDF_SIZE)throw new Error('PDF должен быть не больше 20 МБ.');
   const assetId=boardId();await sendAsset(assetId,new Blob([file],{type:'application/pdf'}),studentId);
   onChange({assetId,name:file.name.slice(0,512),size:file.size});
  }catch(err){setError(err.message);}finally{setBusy(false);onUploading(-1);}
 }
 async function open(download=false){
  setBusy(true);setError('');
  try{
   const blob=await receiveAsset(attachment.assetId,studentId);if(!blob)throw new Error('Не удалось найти конспект.');
   const url=URL.createObjectURL(blob);
   if(download){const link=document.createElement('a');link.href=url;link.download=attachment.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
   else setPreview({url,name:attachment.name});
  }catch(err){setError(err.message);}finally{setBusy(false);}
 }
 return <div className="account-lesson-notes"><span className="account-notes-label">Конспект урока</span>
  {attachment?<><span className="account-notes-name" title={attachment.name}>{attachment.name}</span><div className="account-notes-actions"><button type="button" disabled={busy} onClick={()=>open()} aria-label="Открыть PDF ↗">Открыть PDF<BoardIcon name="external"/></button><button type="button" disabled={busy} onClick={()=>open(true)}><BoardIcon name="download"/>Скачать</button>{teacher&&<button type="button" disabled={busy} onClick={()=>onChange(null)}>Убрать PDF</button>}</div></>:!teacher&&<span className="account-notes-empty">Пока не прикреплён</span>}
  {teacher&&<label className="account-secondary account-notes-upload"><BoardIcon name={attachment?'upload':'plus'}/>{busy?'Загрузка…':attachment?'Заменить PDF':'Прикрепить PDF'}<input aria-label={`Конспект урока ${index+1}`} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file);}}/></label>}
  {busy&&!teacher&&<small role="status">Загружаем конспект…</small>}{error&&<p className="account-error" role="alert">{error}</p>}
  {preview&&<div className="account-pdf-backdrop" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setPreview(null);}}}><section className="account-pdf-dialog" role="dialog" aria-modal="true" aria-label="Конспект урока PDF"><header><strong>{preview.name}</strong><a href={preview.url} download={preview.name} className="account-secondary">Скачать PDF</a><button type="button" className="account-secondary" autoFocus onClick={()=>setPreview(null)}>Закрыть</button></header><iframe title="Просмотр конспекта урока" src={preview.url}/><p>Если просмотр PDF недоступен на устройстве, скачайте файл.</p></section></div>}
 </div>;
}
