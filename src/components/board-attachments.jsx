import BoardIcon from "./board-icons.jsx";
import { useEffect,useState } from "react";
import { readAsset,downloadAsset } from "./board-assets.js";
import {retainBoardImage} from "./board-image-cache.js";
import { pdfPageImage } from "./board-pdf.js";
export function useAssetUrl(id,source) {
  const [result,setResult]=useState(null),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const retry=()=>setAttempt(value=>value+1);window.addEventListener("board-image-retry",retry);return()=>window.removeEventListener("board-image-retry",retry);},[]);
  useEffect(()=>{
    if(!id)return;
    let active=true;const retained=retainBoardImage(id);
    retained.ready.then(url=>{if(active)setResult({id,url});}).catch(()=>{});
    return ()=>{active=false;retained.release();};
  },[id,attempt]);
  return source || (result && result.id===id ? result.url : undefined);
}
export function AssetImage({assetId,src,...props}) {
  const url=useAssetUrl(assetId,src);
  return <image {...props} data-board-asset={assetId} href={url}/>;
}
export function FileCard({item,box,onOpen,selectable,erase}) {
  const {x,y,width,height}=box,header=Math.min(110,height*.2),font=Math.min(38,width*.045);
  return <g data-shape-id={item.id} data-shape-type="attachment" role="button" aria-label={`Открыть файл ${item.name}`} tabIndex={0} pointerEvents="all" style={{cursor:selectable?"grab":"pointer"}} onPointerDown={event=>{if(!selectable&&!erase)event.stopPropagation();}} onClick={()=>{if(!selectable&&!erase)onOpen?.(item.id);}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onOpen?.(item.id);}}}>
    <rect x={x} y={y} width={width} height={height} rx="20" fill="#fff" stroke="#bdcec4" strokeWidth="3"/>
    <rect x={x+2} y={y+2} width={width-4} height={header} rx="18" fill="#edf4ef"/>
    <text x={x+width*.04} y={y+header*.42} fontFamily="Golos Text, Arial, sans-serif" fill="#2f493f" fontSize={font} fontWeight="600">{item.name.length>37?item.name.slice(0,34)+"…":item.name}</text>
    <text x={x+width*.04} y={y+header*.78} fontFamily="Golos Text, Arial, sans-serif" fill="#64786b" fontSize={font*.64}>{item.format==="pdf" ? `PDF · ${item.pageCount} стр. · Нажмите, чтобы открыть` : "Вложение · Нажмите, чтобы открыть"}</text>
    {item.coverId ? <AssetImage assetId={item.coverId} x={x+24} y={y+header+18} width={width-48} height={height-header-36} preserveAspectRatio="xMidYMid meet" pointerEvents="none"/> : <g fill="none" stroke="#91aa9b" strokeWidth="4" pointerEvents="none"><path d={`M${x+width*.38},${y+height*.4} h${width*.18} l${width*.08},${height*.12} v${height*.28} h-${width*.26} z`}/><path d={`M${x+width*.43},${y+height*.61} h${width*.16} m-${width*.16},${height*.07} h${width*.16}`}/></g>}
  </g>;
}
export function AttachmentViewer({item,onClose,onExpand,expanding,expanded,onRename}) {
  const [page,setPage]=useState(1),[asset,setAsset]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(false),[text,setText]=useState(null);
  const [renaming,setRenaming]=useState(false),[fileTitle,setFileTitle]=useState("");
  const extension=item.name.match(/\.[a-z0-9]{1,12}$/i)?.[0]??"";
  const beginRename=()=>{setFileTitle(extension?item.name.slice(0,-extension.length):item.name);setRenaming(true);};
  const rename=event=>{event.preventDefault();if(!fileTitle.trim())return;if(onRename?.(item.id,fileTitle.trim()+extension)!==false)setRenaming(false);};
  const url=useAssetUrl(asset?.assetId);
  useEffect(()=>{
    let active=true;setError("");
    if(item.format==="pdf") {
      setLoading(true);setAsset(null);
      pdfPageImage(item.assetId,page).then(image=>{if(active)setAsset(image);}).catch(err=>{if(active)setError(err.message||"Не удалось открыть страницу.");}).finally(()=>{if(active)setLoading(false);});
    } else if(item.mime?.startsWith("text/") || /\.(txt|csv|md)$/i.test(item.name)) {
      readAsset(item.assetId).then(blob=>blob?.text()).then(value=>{if(active)setText(value?.slice(0,200000)??null);}).catch(()=>{if(active)setError("Не удалось прочитать файл.");});
    }
    return ()=>{active=false;};
  },[item.assetId,item.format,item.mime,item.name,page]);
  const download=()=>downloadAsset(item.assetId,item.name).catch(err=>setError(err.message));
  return <div className="board-dialog-backdrop board-file-backdrop" onClick={event=>{if(event.target===event.currentTarget&&!expanding)onClose();}}>
    <section className="board-file-viewer" role="dialog" aria-modal="true" aria-labelledby="file-viewer-title">
      <header><div><h2 id="file-viewer-title">{item.name}</h2><p>{item.format==="pdf" ? `Страница ${page} из ${item.pageCount}` : "Файл с вашего устройства"}</p></div><button className="board-action" aria-label="Закрыть файл" onClick={onClose} disabled={!!expanding}><BoardIcon name="close"/></button></header>
      <div className="board-file-actions">
        {item.format==="pdf" && <><button className="board-action" aria-label="Предыдущая страница" disabled={page<=1||!!expanding} onClick={()=>setPage(page-1)}><BoardIcon name="arrow-left"/></button><span>{page} / {item.pageCount}</span><button className="board-action" aria-label="Следующая страница" disabled={page>=item.pageCount||!!expanding} onClick={()=>setPage(page+1)}><BoardIcon name="arrow-right"/></button>{onExpand&&<button className="board-action board-pdf-button" disabled={!!expanding} onClick={()=>onExpand(item)}>{expanding || (expanded ? "Перейти к страницам" : "Развернуть все страницы")}</button>}</>}
        <button className="board-action" onClick={download}><BoardIcon name="download"/>Скачать оригинал</button>
        {onRename&&<button type="button" className="board-action" disabled={!!expanding} onClick={beginRename}><BoardIcon name="pen"/>Переименовать файл</button>}
      </div>
      {renaming&&onRename&&<form className="board-file-rename" onSubmit={rename} onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setRenaming(false);}}}><label>Название файла<div><input aria-label="Новое название файла" autoFocus onFocus={event=>event.target.select()} maxLength={512-extension.length} required value={fileTitle} onChange={event=>setFileTitle(event.target.value)}/><span>{extension}</span></div></label><button className="board-action" disabled={!fileTitle.trim()}>Сохранить название файла</button><button type="button" className="board-action" onClick={()=>setRenaming(false)}>Отмена</button></form>}
      <div className="board-file-content" aria-busy={loading}>
        {error ? <p role="alert">{error}</p> : loading || item.format==="pdf"&&!url ? <p role="status">Загружаем страницу…</p> : item.format==="pdf" ? <img src={url} alt={`Страница ${page} — ${item.name}`} /> : text!==null ? <pre>{text}</pre> : <div className="board-file-placeholder"><BoardIcon name="file"/><p>Этот формат можно открыть в приложении на устройстве.</p><button className="board-action board-pdf-button" onClick={download}>Скачать файл</button></div>}
      </div>
    </section>
  </div>;
}
