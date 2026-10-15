import { AttachmentViewer } from "./board-attachments.jsx";
import { storeAsset,readAsset,blobDataUrl } from "./board-assets.js";
import { pdfPageCount,pdfPageImage } from "./board-pdf.js";
import { boardId } from "./board-id.js";
import { clipboardImage, validBoardImage } from "./board-images.js";
import { flushSync } from "react-dom";
import { sanitizeConstructions, sameReference, validSpatialPair, spatialPoint, nearestProjectedEdge, constructionReferences, nextPointLabel, spatialIntersections, planeGeometry, withoutConstruction, nearestCoordinateAxis, clippedSpatialLine, spatialLinePoints } from "./board-space.js";
import { visualizationLayout } from "./board-visualization.jsx";
import { useEffect, useRef, useState } from "react";
import "./whiteboard.css";
import { useBoardViewport, BOARD_TOUCH_QUERY } from "./use-board-viewport.js";
import { figures, figureGroups, drawableTools, BoardShape as Shape, FigureIcon, shapeBounds } from "./board-shapes.jsx";
import { resizedShape, SelectionControls, SelectionHitArea, HandIcon } from "./board-selection.jsx";
import { isSolid, isVisualization, sanitizeEdgePoints, sanitizeFreePoints, validPointLabel, pointLabelKey, vertexNames, solidType } from "./board-solids.js";

const STORAGE_KEY = "uliana-whiteboard-v1";
const NOTEBOOK_KEY = "uliana-whiteboard-v2";
const DRAW_WIDTH = 1600;
const GRID_SIZE = 50;
const BRAND_WIDTH = 80;
const PAGE_WIDTH = DRAW_WIDTH + BRAND_WIDTH;
const PAGE_HEIGHT = 2376;
const tools = [
  ["select", "Ладошка", "hand"], ["pen", "Ручка", "✎"], ["eraser", "Ластик", "⌫"],
  ["line", "Линия", "╱"],
];
const colors = [["#212123", "Чёрный"], ["#2f493f", "Зелёный"], ["#3058a0", "Синий"], ["#b24838", "Красный"]];

function constructionTarget(hit) {
  const target=hit?.closest("[data-free-point-id], [data-intersection-point-id], [data-edge-point-id], [data-spatial-line-id], [data-spatial-plane-id]");
  if (!target) return null;
  const kind=target.hasAttribute("data-free-point-id") ? "free" : target.hasAttribute("data-intersection-point-id") ? "intersection" : target.hasAttribute("data-edge-point-id") ? "point" : target.hasAttribute("data-spatial-line-id") ? "line" : "plane";
  const id=target.dataset.freePointId??target.dataset.intersectionPointId??target.dataset.edgePointId??target.dataset.spatialLineId??target.dataset.spatialPlaneId;
  return {kind,id,shapeId:target.closest("[data-shape-id]")?.dataset.shapeId};
}

function loadNotebook() {
  try {
    const notebook = JSON.parse(localStorage.getItem(NOTEBOOK_KEY));
    const stored = notebook?.items ?? JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(stored) || stored.length > 10000) return { items: [], pageCount: 3 };
    const items = stored.filter(item => item && typeof item.id === "string" &&
      drawableTools.includes(item.type) && (item.type!=="image" || validBoardImage(item.src) || typeof item.assetId==="string") && (item.type!=="attachment" || typeof item.assetId==="string" && typeof item.name==="string" && item.name.length<=512 && ["pdf","file"].includes(item.format) && (item.format!=="pdf" || Number.isInteger(item.pageCount)&&item.pageCount>0)) &&
      /^#[0-9a-f]{6}$/i.test(item.color) && Number.isFinite(item.size) && item.size > 0 && item.size <= 24 &&
      Array.isArray(item.points) && item.points.length && item.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))
      .map(item => ({ ...item, page: Number.isInteger(item.page) && item.page >= 0 && item.page < 100 ? item.page : 0,
        ...(isSolid(item.type) ? { rotation: Array.isArray(item.rotation) && item.rotation.length === 3 && item.rotation.every(Number.isFinite) ? item.rotation.map(value=>value%360) : [0,0,0] } : {}),
        ...(isVisualization(item.type) ? {edgePoints:sanitizeEdgePoints(item.type,item.edgePoints),...(item.type==="viz-space" || item.freePoints ? {freePoints:sanitizeFreePoints(item.freePoints)} : {})} : {}) }))
      .map(item => isVisualization(item.type) ? sanitizeConstructions(item) : item);
    const savedCount = Number.isInteger(notebook?.pageCount) && notebook.pageCount >= 1 && notebook.pageCount <= 100 ? notebook.pageCount : 3;
    return { items, pageCount: Math.max(1, savedCount, ...items.map(item => item.page + 1)) };
  } catch { return { items: [], pageCount: 3 }; }
}

async function renderPage(node) {
  const copy = node.cloneNode(true);
  copy.querySelectorAll("[data-axis-controls], [data-selection-controls], [data-selection-hit], [data-viz-controls]").forEach(node => node.remove());
  await Promise.all([...copy.querySelectorAll("image[data-board-asset]")].map(async node=>{
    const blob=await readAsset(node.dataset.boardAsset);if(!blob)throw new Error("Файл не найден");node.setAttribute("href",await blobDataUrl(blob));
  }));
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(PAGE_WIDTH)); copy.setAttribute("height", String(PAGE_HEIGHT));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = document.createElement("canvas"); canvas.width = PAGE_WIDTH; canvas.height = PAGE_HEIGHT;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export default function Whiteboard() {
  const [initial] = useState(loadNotebook);
  const [items, setItems] = useState(initial.items);
  const itemsRef = useRef(items);
  const [pageCount, setPageCount] = useState(initial.pageCount);
  const pageCountRef = useRef(pageCount);
  const fileInput=useRef(null);
  const [openFile,setOpenFile]=useState(null);
  const [fileBusy,setFileBusy]=useState(false);
  const [fileNotice,setFileNotice]=useState("");
  const [expanding,setExpanding]=useState("");
  const importing=useRef(false);
  const [exporting, setExporting] = useState(false);
  const pendingPage = useRef(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(colors[0][0]);
  const [size, setSize] = useState(4);
  const [grid, setGrid] = useState(true);
  const [draft, setDraft] = useState(null);
  const [selectedAxesId, setSelectedAxesId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [manipulation, setManipulation] = useState("move");
  const [visualizationModes,setVisualizationModes] = useState({});
  const [lineStarts,setLineStarts] = useState({});
  const [planeStarts,setPlaneStarts] = useState({});
  const [renamePoint,setRenamePoint] = useState(null);
  const [pointName,setPointName] = useState("");
  const [pointCoordinates,setPointCoordinates] = useState(["0","0","0"]);
  const [renameError,setRenameError] = useState("");
  const gesture = useRef(null);
  const [optionsOpen,setOptionsOpen] = useState(false);
  const {viewportRef,zoom,changeZoom,captureHandlers,startPan,movePan,endPan} = useBoardViewport(() => {
    if (gesture.current) update(gesture.current.before);
    gesture.current = null; setDraft(null); setLineStarts({}); setPlaneStarts({});
  });
  const sheets = useRef([]);
  const figuresMenu = useRef(null);
  const activeFigure = figures.find(([value]) => value === tool);
  const [clearOpen, setClearOpen] = useState(false);
  const [deletePage, setDeletePage] = useState(null);
  const deleteFrom=Number(deletePage?.from),deleteTo=Number(deletePage?.mode==="range" ? deletePage?.to : deletePage?.from);
  const deleteCount=deleteTo-deleteFrom+1;
  const validDeletion=!!deletePage && Number.isInteger(deleteFrom)&&Number.isInteger(deleteTo)&&deleteFrom>=1&&deleteTo<=pageCount&&deleteTo>=deleteFrom&&deleteCount<pageCount;
  const [status, setStatus] = useState("Сохраняется в этом браузере");
  const selectedItem = draft?.id === selectedId ? draft : items.find(item => item.id === selectedId);
  const viewedFile=items.find(item=>item.id===openFile && item.type==="attachment");
  const selectedSolid = tool === "select" && selectedItem && isSolid(selectedItem.type) && !isVisualization(selectedItem.type);

  const update = (value) => { itemsRef.current = value; setItems(value); };
  const updatePageCount = count => { pageCountRef.current = count; setPageCount(count); };
  const snapshot = () => ({ items: itemsRef.current, pageCount: pageCountRef.current });
  const remember = (savedItems, count = pageCountRef.current) => { setPast(history => [...history.slice(-49), { items: savedItems, pageCount: count }]); setFuture([]); };
  const editStyle = (key, value) => {
    if (key === "color") setColor(value); else setSize(value);
    if (tool !== "select") return;
    const selected = itemsRef.current.find(item => item.id === selectedId);
    if (!selected || selected[key] === value) return;
    remember(itemsRef.current);
    update(itemsRef.current.map(item => item.id === selectedId ? { ...item, [key]: value } : item));
  };
  const undo = () => {
    if (!past.length || gesture.current) return;
    const present = snapshot();
    setFuture(history => [...history, present]);
    update(past.at(-1).items); updatePageCount(past.at(-1).pageCount); setPast(past.slice(0, -1));
  };
  const redo = () => {
    if (!future.length || gesture.current) return;
    const present = snapshot();
    setPast(history => [...history, present]);
    update(future.at(-1).items); updatePageCount(future.at(-1).pageCount); setFuture(future.slice(0, -1));
  };

  const goToPage = page => {
    sheets.current[page]?.closest(".board-page")?.scrollIntoView({ block: "start" });
  };
  const addPage = () => {
    remember(itemsRef.current);
    pendingPage.current = pageCount;
    updatePageCount(pageCount + 1);
  };
  const removePage = event => {
    event.preventDefault();
    const count=pageCountRef.current,from=deleteFrom-1,to=deleteTo-1;
    if(!validDeletion || to>=count || deleteCount>=count)return;
    setDeletePage(null);
    remember(itemsRef.current);
    const remaining=itemsRef.current.filter(item=>item.page<from||item.page>to).map(item=>item.page>to?{...item,page:item.page-deleteCount}:item);
    update(remaining);
    pendingPage.current=Math.min(from,count-deleteCount-1);
    updatePageCount(count-deleteCount);
    setLineStarts({});setPlaneStarts({});
    if(!remaining.some(item=>item.id===selectedId))setSelectedId(null);
    if(!remaining.some(item=>item.id===selectedAxesId))setSelectedAxesId(null);
  };
  const insertVisualization = type => {
    const top = (window.matchMedia(BOARD_TOUCH_QUERY).matches ? viewportRef.current.getBoundingClientRect().top : document.querySelector(".board-controls").getBoundingClientRect().bottom) + 24;
    const page = Math.max(0, sheets.current.findIndex(node => node.getBoundingClientRect().bottom > top + 180));
    const bounds = sheets.current[page].getBoundingClientRect();
    const y = Math.max(80, Math.min(PAGE_HEIGHT - 980, (top - bounds.top) * PAGE_WIDTH / bounds.width + 40));
    const item = { id: boardId(), page, type, color: "#2f493f", size: 4, points: [[80,y],[1520,y+900]], rotation: [0,0,0], edgePoints: [], intersectionPoints: [], spatialLines: [], spatialPlanes: [],...(type==="viz-space" ? {freePoints:[]} : {}) };
    remember(itemsRef.current);
    update([...itemsRef.current,item]);
    setSelectedId(item.id); setTool("visualization");
  };
  const resetView = () => {
    if (!selectedSolid) return;
    remember(itemsRef.current);
    update(itemsRef.current.map(item=>item.id===selectedId ? {...item,rotation:[0,0,0]} : item));
  };
  const visualizationAction = (id, action) => {
    const item = itemsRef.current.find(item=>item.id===id);
    if (!item) return;
    setSelectedId(id); setTool("visualization");
    setLineStarts(starts=>({...starts,[id]:null}));
    setPlaneStarts(starts=>({...starts,[id]:[]}));
    if (action === "reset") {
      remember(itemsRef.current);
      update(itemsRef.current.map(item=>item.id===id ? {...item,rotation:[0,0,0]} : item));
    } else setVisualizationModes(modes=>({...modes,[id]:action}));
  };
  const visualizationProps = item => ({mode:tool==="select" ? "move" : visualizationModes[item.id]??"rotate",lineStart:lineStarts[item.id],planeStart:planeStarts[item.id]??[],onAction:visualizationAction,scale:PAGE_WIDTH/(sheets.current[item.page]?.getBoundingClientRect().width||PAGE_WIDTH)});
  const openPointEditor = (item,reference) => {
    const field=reference.kind==="free" ? "freePoints" : reference.kind==="intersection" ? "intersectionPoints" : "edgePoints";
    const point=item[field]?.find(point=>point.id===reference.id);
    if (!point) return;
    setRenamePoint({itemId:item.id,pointId:point.id,field});setPointName(point.label);setPointCoordinates((point.position??[0,0,0]).map(String));setRenameError("");
  };
  const savePointName = event => {
    event.preventDefault();
    const item=itemsRef.current.find(item=>item.id===renamePoint?.itemId),point=item?.[renamePoint?.field]?.find(point=>point.id===renamePoint?.pointId);
    if (!item || !point) {setRenamePoint(null);return;}
    const label=pointName.trim();
    if (!validPointLabel(label)) {setRenameError("Введите до 8 букв, цифр или штрихов без пробелов.");return;}
    const used=[...(item.edgePoints??[]),...(item.intersectionPoints??[]),...(item.freePoints??[])].filter(other=>other.id!==point?.id).map(other=>other.label).concat(vertexNames[solidType(item.type)]);
    if (used.some(name=>pointLabelKey(name)===pointLabelKey(label))) {setRenameError("Такое имя уже есть у другой точки или вершины.");return;}
    const position=pointCoordinates.map(value=>Number(value));
    if (renamePoint.field==="freePoints" && (pointCoordinates.some(value=>!value.trim()) || position.some(value=>!Number.isFinite(value)||Math.abs(value)>100))) {setRenameError("Координаты должны быть числами от −100 до 100.");return;}
    if (label!==point.label || renamePoint.field==="freePoints" && position.some((value,index)=>value!==point.position[index])) {
      remember(itemsRef.current);
      update(itemsRef.current.map(current=>current.id===item.id ? sanitizeConstructions({...current,[renamePoint.field]:current[renamePoint.field].map(other=>other.id===point.id ? {...other,label,...(renamePoint.field==="freePoints" ? {position} : {})} : other)}) : current));
    }
    setRenamePoint(null);
  };
  useEffect(() => {
    if (pendingPage.current === null) return;
    goToPage(pendingPage.current);
    pendingPage.current = null;
  }, [pageCount]);

  useEffect(() => {
    const closeFigures = event => {
      if (!figuresMenu.current?.contains(event.target) && figuresMenu.current) figuresMenu.current.open = false;
    };
    document.addEventListener("pointerdown", closeFigures);
    return () => document.removeEventListener("pointerdown", closeFigures);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(NOTEBOOK_KEY, JSON.stringify({ items, pageCount })); setStatus("Сохранено в этом браузере"); }
    catch { setStatus("Не удалось сохранить. Скачайте PDF, чтобы не потерять записи."); }
  }, [items, pageCount]);

  useEffect(() => {
    const handle = event => {
      if ((event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) && event.key !== "Escape") return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault(); if (event.shiftKey) redo(); else undo();
      }
      if (event.key === "Escape") {
        if(expanding)return;
        setOpenFile(null);
        setClearOpen(false);
        setDeletePage(null);
        setRenamePoint(null);
        setSelectedId(null);
        setLineStarts({});
        setPlaneStarts({});
        if (figuresMenu.current?.open) { figuresMenu.current.open = false; figuresMenu.current.querySelector("summary")?.focus(); }
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });

  useEffect(() => {
    const paste = event => {
      if(event.target.closest?.("input, textarea, select, [contenteditable='true']") || renamePoint || clearOpen || deletePage!==null || openFile)return;
      const files=[...(event.clipboardData?.items??[])].filter(item=>item.kind==="file" && /^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(item.type)).map(item=>item.getAsFile()).filter(Boolean);
      if(!files.length)return;
      event.preventDefault();
      const viewport=viewportRef.current.getBoundingClientRect();
      const top=window.matchMedia(BOARD_TOUCH_QUERY).matches ? viewport.top : document.querySelector(".board-controls").getBoundingClientRect().bottom;
      const bottom=Math.min(innerHeight,viewport.bottom);
      const page=sheets.current.map((node,index)=>({index,bounds:node.getBoundingClientRect()})).sort((a,b)=>Math.max(0,Math.min(b.bounds.bottom,bottom)-Math.max(b.bounds.top,top))-Math.max(0,Math.min(a.bounds.bottom,bottom)-Math.max(a.bounds.top,top)))[0];
      if(!page)return;
      const visibleX=(Math.max(page.bounds.left,viewport.left)+Math.min(page.bounds.right,viewport.right))/2;
      const visibleY=(Math.max(page.bounds.top,top)+Math.min(page.bounds.bottom,bottom))/2;
      const scale=PAGE_WIDTH/page.bounds.width,center=[(visibleX-page.bounds.left)*scale,(visibleY-page.bounds.top)*scale];
      void (async()=>{
        try {
          for(const file of files) {
            const image=await clipboardImage(file);
            if(page.index>=pageCountRef.current)continue;
            const ratio=Math.min(1,1200/image.width,1400/image.height),width=image.width*ratio,height=image.height*ratio;
            const x=Math.max(0,Math.min(DRAW_WIDTH-width,center[0]-width/2)),y=Math.max(0,Math.min(PAGE_HEIGHT-height,center[1]-height/2));
            const item={id:boardId(),type:"image",page:page.index,color:"#212123",size:4,points:[[x,y],[x+width,y+height]],src:image.src};
            remember(itemsRef.current);update([...itemsRef.current,item]);setSelectedId(item.id);setTool("pen");
          }
        } catch {setStatus("Не удалось вставить изображение. Попробуйте скопировать скриншот ещё раз.");}
      })();
    };
    window.addEventListener("paste",paste);
    return ()=>window.removeEventListener("paste",paste);
  });

  const importFiles = async files => {
    if(importing.current || !files.length)return;
    importing.current=true;setFileBusy(true);
    const viewport=viewportRef.current.getBoundingClientRect();
    const top=window.matchMedia(BOARD_TOUCH_QUERY).matches ? viewport.top : document.querySelector(".board-controls").getBoundingClientRect().bottom;
    const bottom=Math.min(innerHeight,viewport.bottom);
    const page=sheets.current.map((node,index)=>({index,bounds:node.getBoundingClientRect()})).sort((a,b)=>Math.max(0,Math.min(b.bounds.bottom,bottom)-Math.max(b.bounds.top,top))-Math.max(0,Math.min(a.bounds.bottom,bottom)-Math.max(a.bounds.top,top)))[0];
    const center=[800,Math.max(300,Math.min(1700,((top+bottom)/2-page.bounds.top)*PAGE_WIDTH/page.bounds.width))];
    const errors=[];let added=0;
    try {
      for(const file of files) {
        setFileNotice(`Загружаем ${file.name}…`);
        try {
          if(file.size>50*1024*1024)throw new Error("Файл больше 50 МБ.");
          let content;
          if(file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(file.name)) {
            try {
              const image=await clipboardImage(file),assetId=await storeAsset(await(await fetch(image.src)).blob()),ratio=Math.min(1,1200/image.width,1600/image.height);
              content={type:"image",assetId,width:image.width*ratio,height:image.height*ratio,name:file.name};
            } catch {content=null;}
          }
          if(!content) {
            const assetId=await storeAsset(file),pdf=file.type==="application/pdf"||/\.pdf$/i.test(file.name);
            const pageCount=pdf ? await pdfPageCount(assetId) : undefined;
            const cover=pdf ? await pdfPageImage(assetId,1) : null;
            content={type:"attachment",assetId,name:file.name.slice(0,512),mime:file.type,format:pdf?"pdf":"file",...(pdf?{pageCount,coverId:cover.assetId}:{}),width:760,height:pdf?1040:500};
          }
          const {width,height,...fields}=content;
          const x=Math.max(0,Math.min(DRAW_WIDTH-width,center[0]-width/2+added*24)),y=Math.max(0,Math.min(PAGE_HEIGHT-height,center[1]-height/2+added*24));
          const item={...fields,id:boardId(),page:Math.min(page.index,pageCountRef.current-1),color:"#212123",size:4,points:[[x,y],[x+width,y+height]]};
          remember(itemsRef.current);update([...itemsRef.current,item]);setSelectedId(item.id);setTool("pen");added++;
        } catch(error) {errors.push(`${file.name}: ${error?.name==="PasswordException" ? "PDF защищён паролем." : error?.message||"Не удалось загрузить файл."}`);}
      }
      setFileNotice(errors.length?errors.join(" "):`Добавлено файлов: ${added}. Изображения меняются ладошкой; нажмите на документ, чтобы открыть.`);
    } finally {importing.current=false;setFileBusy(false);}
  };
  const expandFile = async file => {
    if(expanding)return;
    const existing=itemsRef.current.filter(item=>item.documentId===file.id);
    if(existing.length===file.pageCount){setOpenFile(null);goToPage(Math.min(...existing.map(item=>item.page)));return;}
    const missing=Array.from({length:file.pageCount},(_,i)=>i+1).filter(number=>!existing.some(item=>item.sourcePage===number));
    if(pageCountRef.current+missing.length>100){setFileNotice("На доске помещается до 100 листов. Удалите лишние листы или просматривайте PDF в окне.");return;}
    setExpanding("Готовим страницы…");
    try {
      const pages=[];
      for(const number of missing){setExpanding(`Страница ${number} из ${file.pageCount}…`);pages.push({number,...await pdfPageImage(file.assetId,number)});}
      const current=itemsRef.current.find(item=>item.id===file.id);
      if(!current)return;
      if(pageCountRef.current+pages.length>100)throw new Error("Недостаточно свободных листов на доске.");
      // Insert each PDF page on its own new sheet; existing notes shift together with their sheets.
      const after=Math.max(current.page,...existing.map(item=>item.page));
      const images=pages.map((image,index)=>{
        const scale=Math.min(1480/image.width,2180/image.height),width=image.width*scale,height=image.height*scale;
        return {id:boardId(),type:"image",page:after+1+index,color:"#212123",size:4,assetId:image.assetId,name:`${file.name} · ${image.number}`,documentId:file.id,sourcePage:image.number,points:[[(DRAW_WIDTH-width)/2,80],[(DRAW_WIDTH+width)/2,80+height]]};
      });
      remember(itemsRef.current);
      update([...itemsRef.current.map(item=>item.page>after?{...item,page:item.page+images.length}:item),...images]);
      pendingPage.current=after+1;updatePageCount(pageCountRef.current+images.length);setOpenFile(null);setTool("pen");setFileNotice("Страницы PDF размещены по порядку. На них можно писать ручкой.");
    } catch(error){setFileNotice(error?.message||"Не удалось развернуть PDF.");}
    finally{setExpanding("");}
  };

  const point = event => {
    // Read the current viewport bounds: SVG screen matrices can lag behind scrolling.
    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const left = parseFloat(style.borderLeftWidth) || 0;
    const right = parseFloat(style.borderRightWidth) || 0;
    const top = parseFloat(style.borderTopWidth) || 0;
    const bottom = parseFloat(style.borderBottomWidth) || 0;
    const width = bounds.width - left - right;
    const height = bounds.height - top - bottom;
    const scale = Math.min(width / PAGE_WIDTH, height / PAGE_HEIGHT);
    const x = (event.clientX - bounds.left - left - (width - PAGE_WIDTH * scale) / 2) / scale;
    const y = (event.clientY - bounds.top - top - (height - PAGE_HEIGHT * scale) / 2) / scale;
    return [Math.max(0, Math.min(DRAW_WIDTH, x)), Math.max(0, Math.min(PAGE_HEIGHT, y))];
  };
  const erase = event => {
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const selection=constructionTarget(hit);
    if (selection) {
      update(itemsRef.current.map(item=>item.id===selection.shapeId ? withoutConstruction(item,selection) : item));
      return;
    }
    const target = hit?.closest("[data-shape-id]");
    if (target && Number(target.closest("svg")?.dataset.pageIndex) === gesture.current?.item.page) update(itemsRef.current.filter(item => item.id !== target.dataset.shapeId));
  };
  const start = event => {
    if (event.button !== 0 || gesture.current || event.target.closest("[data-brand-strip]")) return;
    event.preventDefault();
    const page = Number(event.currentTarget.dataset.pageIndex);
    const handle = event.target.closest("[data-resize-id]");
    const visualization = event.target.closest("[data-viz-body], [data-viz-header]");
    if (!handle && visualization && (tool === "select" || tool === "visualization")) {
      const id = visualization.closest("[data-shape-id]")?.dataset.shapeId;
      const item = itemsRef.current.find(item => item.id === id && item.page === page);
      if (!item) return;
      flushSync(()=>setSelectedId(item.id));
      const mode = visualization.hasAttribute("data-viz-header") || tool==="select" ? "move" : visualizationModes[item.id]??"rotate";
      if (mode === "rename") {
        const {model}=visualizationLayout(item,shapeBounds(item)),position=point(event),scale=PAGE_WIDTH/(event.currentTarget.getBoundingClientRect().width||PAGE_WIDTH);
        const hit=event.target.closest("text")?.closest("[data-construction-point-id]");
        const nearest=constructionReferences(item).map(reference=>({reference,distance:Math.hypot(...spatialPoint(item,reference,model).map((value,index)=>value-position[index]))})).sort((a,b)=>a.distance-b.distance)[0];
        const reference=hit ? {kind:hit.dataset.pointKind,id:hit.dataset.constructionPointId} : nearest?.distance<=14*scale ? nearest.reference : null;
        if (!reference) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,item,mode:"rename",reference,clientStart:[event.clientX,event.clientY]};return;
      }
      if (mode === "point" && item.type==="viz-space") {
        if ((item.freePoints??[]).length>=200) return;
        const {model}=visualizationLayout(item,shapeBounds(item));
        const nearest=nearestCoordinateAxis(model,point(event)),scale=PAGE_WIDTH/(event.currentTarget.getBoundingClientRect().width||PAGE_WIDTH);
        const position=nearest?.distance<=14*scale ? nearest.position : null;
        if (!position || (item.freePoints??[]).some(point=>Math.hypot(...point.position.map((value,index)=>value-position[index]))<1e-7)) return;
        const mark={id:boardId(),label:nextPointLabel(item),position};
        event.currentTarget.setPointerCapture(event.pointerId);
        const marked={...item,freePoints:[...(item.freePoints??[]),mark]};
        gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,item:marked,mode:"mark",clientStart:[event.clientX,event.clientY]};setDraft(marked);return;
      }
      if (mode === "delete") {
        let selection=constructionTarget(event.target);
        // Touch targets can overlap on a small screen; the closest dot wins.
        if (selection && ["free","point","intersection"].includes(selection.kind) && !event.target.closest("text")) {
          const {model}=visualizationLayout(item,shapeBounds(item)),position=point(event);
          const nearest=constructionReferences(item).map(reference=>({reference,distance:Math.hypot(...spatialPoint(item,reference,model).map((value,index)=>value-position[index]))})).sort((a,b)=>a.distance-b.distance)[0];
          if(nearest) selection={kind:nearest.reference.kind,id:nearest.reference.id,shapeId:item.id};
        }
        if (!selection || selection.shapeId!==item.id) return;
        const changed=withoutConstruction(item,selection);
        if (changed===item) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,item:changed,mode:"mark",clientStart:[event.clientX,event.clientY]};
        setDraft(changed);return;
      }
      if (mode === "intersection") {
        if ((item.intersectionPoints??[]).length>=200 || event.target.closest("[data-construction-point-id]")) return;
        const {model}=visualizationLayout(item,shapeBounds(item)),position=point(event),scale=PAGE_WIDTH/(event.currentTarget.getBoundingClientRect().width||PAGE_WIDTH);
        const nearest=spatialIntersections(item).map(point=>({...point,distance:Math.hypot(...model.projectPoint(point.position).map((value,index)=>value-position[index]))})).sort((a,b)=>a.distance-b.distance)[0];
        if (!nearest || nearest.distance>14*scale) { setStatus("Выберите пересечение прямых или прямой с ребром в пространстве"); return; }
        if ((item.intersectionPoints??[]).some(point=>Math.hypot(...point.position.map((value,index)=>value-nearest.position[index]))<1e-7)) return;
        const mark={id:boardId(),label:nextPointLabel(item),position:nearest.position,lines:nearest.lines,...(nearest.edge ? {edge:nearest.edge} : {})};
        event.currentTarget.setPointerCapture(event.pointerId);
        const marked={...item,intersectionPoints:[...(item.intersectionPoints??[]),mark]};
        gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,item:marked,mode:"mark",clientStart:[event.clientX,event.clientY]};
        setDraft(marked);return;
      }
      if (mode === "parallel" && lineStarts[item.id]) {
        const {model}=visualizationLayout(item,shapeBounds(item)),box=shapeBounds(item),position=point(event),scale=PAGE_WIDTH/(event.currentTarget.getBoundingClientRect().width||PAGE_WIDTH);
        const candidates=[];
        const add=(source,a,b)=>{
          const delta=b.map((v,i)=>v-a[i]),length=delta[0]**2+delta[1]**2;
          const t=Math.max(0,Math.min(1,delta.reduce((sum,v,i)=>sum+v*(position[i]-a[i]),0)/(length||1)));
          candidates.push({source,distance:Math.hypot(...position.map((v,i)=>v-a[i]-t*delta[i]))});
        };
        for(const line of item.spatialLines??[]) {
          const clip=clippedSpatialLine(item,line,model,box);
          if(clip)add({kind:"line",id:line.id},...clip.ends);
        }
        if(item.type==="viz-space") {
          for(let axis=0;axis<3;axis++)add({kind:"axis",axis},...[-1,1].map(sign=>model.projectPoint([0,1,2].map(i=>i===axis?sign*model.extent:0))));
        } else for(const edge of model.edges)add({kind:"edge",edge:edge.pair},...edge.pair.map(index=>model.vertices[index]));
        const nearest=candidates.sort((a,b)=>a.distance-b.distance)[0];
        if(!nearest || nearest.distance>14*scale)return;
        const line={id:boardId(),kind:"parallel",through:[lineStarts[item.id]],parallelTo:nearest.source};
        if(!spatialLinePoints(item,line) || (item.spatialLines??[]).length>=200)return;
        setLineStarts(starts=>({...starts,[item.id]:null}));
        event.currentTarget.setPointerCapture(event.pointerId);
        const connected={...item,spatialLines:[...(item.spatialLines??[]),line]};
        gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,item:connected,mode:"mark",clientStart:[event.clientX,event.clientY]};setDraft(connected);return;
      }
      if (mode === "space-line" || mode === "segment" || mode === "plane" || mode === "parallel") {
        const {model}=visualizationLayout(item,shapeBounds(item));
        const position=point(event),scale=PAGE_WIDTH/(event.currentTarget.getBoundingClientRect().width||PAGE_WIDTH);
        const candidates=[...constructionReferences(item),...(item.type==="viz-space" ? [] : model.vertices.map((_,index)=>({kind:"vertex",index})))];
        const nearest=candidates.map(reference=>({reference,distance:Math.hypot(...spatialPoint(item,reference,model).map((value,index)=>value-position[index]))})).sort((a,b)=>a.distance-b.distance)[0];
        const label=event.target.closest("text"),pointHit=label?.closest("[data-construction-point-id]"),vertexHit=label?.closest("[data-vertex-index]");
        const reference=pointHit ? {kind:pointHit.dataset.pointKind,id:pointHit.dataset.constructionPointId} : vertexHit ? {kind:"vertex",index:Number(vertexHit.dataset.vertexIndex)} : nearest?.distance<=14*scale ? nearest.reference : null;
        if (!reference) return;
        if (mode === "parallel") {setLineStarts(starts=>({...starts,[item.id]:reference}));return;}
        if (mode === "plane") {
          const selected=planeStarts[item.id]??[];
          if (selected.some(ref=>sameReference(ref,reference))) {setPlaneStarts(starts=>({...starts,[item.id]:selected.filter(ref=>!sameReference(ref,reference))}));return;}
          const through=[...selected,reference];
          if (through.length<3) {setPlaneStarts(starts=>({...starts,[item.id]:through}));return;}
          if (!planeGeometry(item,through)) {setStatus("Выберите три точки, не лежащие на одной прямой");return;}
          setPlaneStarts(starts=>({...starts,[item.id]:[]}));
          if ((item.spatialPlanes??[]).length>=50 || (item.spatialPlanes??[]).some(plane=>plane.through.every(ref=>through.some(other=>sameReference(ref,other))))) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const withPlane={...item,spatialPlanes:[...(item.spatialPlanes??[]),{id:boardId(),through}]};
          gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,item:withPlane,mode:"mark",clientStart:[event.clientX,event.clientY]};
          setDraft(withPlane);return;
        }
        const first=lineStarts[item.id];
        if (!first) { setLineStarts(starts=>({...starts,[item.id]:reference})); return; }
        setLineStarts(starts=>({...starts,[item.id]:null}));
        const through=[first,reference];
        if (!validSpatialPair(item,through) || (item.spatialLines??[]).length>=200 || (item.spatialLines??[]).some(line=>line.kind!=="parallel" && (line.kind==="segment")===(mode==="segment") && (line.through.every((ref,i)=>sameReference(ref,through[i])) || line.through.every((ref,i)=>sameReference(ref,through[1-i]))))) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const connected={...item,spatialLines:[...(item.spatialLines??[]),{id:boardId(),through,...(mode==="segment" ? {kind:"segment"} : {})}]};
        gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,item:connected,mode:"mark",clientStart:[event.clientX,event.clientY]};
        setDraft(connected); return;
      }
      if (mode === "point") {
        if (event.target.closest("[data-construction-point-id]") || (item.edgePoints??[]).length>=200) return;
        const {model} = visualizationLayout(item,shapeBounds(item));
        const p=point(event);
        const nearest=nearestProjectedEdge(model,p);
        const scale=PAGE_WIDTH/(event.currentTarget.getBoundingClientRect().width||PAGE_WIDTH);
        if (!nearest || nearest.distance>12*scale) return;
        const pair=nearest.pair,t=Math.max(.02,Math.min(.98,nearest.t));
        const existing=item.edgePoints??[];
        if (existing.some(mark=>mark.edge.join(",")===pair.join(",")&&Math.abs(mark.t-t)<.025)) return;
        const mark={id:boardId(),edge:pair,t,label:nextPointLabel(item)};
        event.currentTarget.setPointerCapture(event.pointerId);
        const marked = {...item,edgePoints:[...existing,mark]};
        gesture.current = {pointerId:event.pointerId,before:itemsRef.current,original:item,item:marked,mode:"mark",clientStart:[event.clientX,event.clientY]};
        setDraft(marked); return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { pointerId: event.pointerId, before: itemsRef.current, item, original: item, start: point(event), clientStart: [event.clientX,event.clientY], mode };
      setDraft(item); return;
    }
    if (tool === "visualization") { startPan(event); return; }
    if (tool === "select") {
      const target = event.target.closest("[data-select-id], [data-shape-id], [data-resize-id]");
      const id = target?.dataset.selectId ?? target?.dataset.shapeId ?? target?.dataset.resizeId;
      const item = itemsRef.current.find(item => item.id === id && item.page === page);
      flushSync(()=>setSelectedId(item?.id ?? null));
      if (!item) { startPan(event); return; }
      setColor(item.color); setSize(item.size);
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { pointerId: event.pointerId, before: itemsRef.current, item, original: item, start: point(event), clientStart:[event.clientX,event.clientY], mode: handle ? "resize" : isSolid(item.type) && manipulation === "rotate" ? "rotate" : "move", corner: Number(handle?.dataset.selectCorner) };
      setDraft(item);
      return;
    }
    const existing = tool === "axes" && event.target.closest('[data-shape-type="axes"]');
    if (existing) { setSelectedAxesId(existing.dataset.shapeId); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    const resizedItem = handle && itemsRef.current.find(item => item.id === handle.dataset.resizeId);
    if (resizedItem) {
      gesture.current = { pointerId: event.pointerId, before: itemsRef.current, item: resizedItem, resizeHandle: Number(handle.dataset.handleIndex) };
      setDraft(resizedItem);
      return;
    }
    const id = boardId();
    if (tool === "axes") setSelectedAxesId(id);
    gesture.current = { pointerId: event.pointerId, before: itemsRef.current, item: { id, page, type: tool, color, size, points: [point(event)] } };
    if (tool === "eraser") erase(event); else setDraft(gesture.current.item);
  };
  const move = event => {
    if (movePan(event)) return;
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.item.type === "eraser") { erase(event); return; }
    if (current.mode === "mark" || current.mode === "rename") {
      if (Math.hypot(event.clientX-current.clientStart[0],event.clientY-current.clientStart[1])>10) { current.cancelled = true; setDraft(null); }
      return;
    }
    const next = point(event);
    if (current.mode === "rotate") {
      const rotation = current.original.rotation ?? [0,0,0];
      current.item = { ...current.original, rotation:[(rotation[0]+(event.clientY-current.clientStart[1])*.6)%360,(rotation[1]+(event.clientX-current.clientStart[0])*.6)%360,rotation[2]] };
      setDraft(current.item); return;
    }
    if (current.mode === "move") {
      const box = shapeBounds(current.original);
      const dx = Math.max(-box.x, Math.min(DRAW_WIDTH - box.x - box.width, next[0] - current.start[0]));
      const dy = Math.max(-box.y, Math.min(PAGE_HEIGHT - box.y - box.height, next[1] - current.start[1]));
      current.item = { ...current.original, points: current.original.points.map(([x,y]) => [x+dx,y+dy]) };
      setDraft(current.item); return;
    }
    if (current.mode === "resize") {
      current.item = resizedShape(current.original, current.corner, next, DRAW_WIDTH, PAGE_HEIGHT);
      setDraft(current.item); return;
    }
    current.item = { ...current.item, points: current.resizeHandle !== undefined
      ? current.item.points.map((p, index) => index === current.resizeHandle ? next : p)
      : current.item.type === "pen" ? [...current.item.points, next] : [current.item.points[0], next] };
    setDraft(current.item);
  };
  const finish = event => {
    endPan(event);
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null; setDraft(null);
    if (event.type === "pointercancel") { update(current.before); return; }
    if (current.mode === "rename") {
      if (!current.cancelled) requestAnimationFrame(()=>openPointEditor(current.original,current.reference));
      return;
    }
    if (current.mode === "mark") {
      if (!current.cancelled) {
        remember(current.before);
        update(current.before.map(item=>item.id===current.item.id ? current.item : item));
      }
      return;
    }
    if (current.mode) {
      if (current.item.points.length !== current.original.points.length || current.item.points.some(([x,y], i) => Math.abs(x-current.original.points[i][0]) > .01 || Math.abs(y-current.original.points[i][1]) > .01) || (current.item.rotation ?? []).some((angle,i)=>Math.abs(angle-(current.original.rotation?.[i] ?? 0))>.01)) {
        remember(current.before);
        update(current.before.map(item => item.id === current.item.id ? current.item : item));
      }
      return;
    }
    if (current.item.type === "eraser") {
      if (itemsRef.current !== current.before) remember(current.before);
    } else {
      remember(current.before);
      update(current.resizeHandle !== undefined ? current.before.map(item => item.id === current.item.id ? current.item : item) : [...current.before, current.item]);
    }
  };
  const downloadPdf = async () => {
    if (exporting) return;
    setExporting(true);
    const date = new Date();
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const filename = `Урок ${date.getDate()} ${months[date.getMonth()]}.pdf`;
    const pages = sheets.current.slice(0, pageCount).map(node => node.cloneNode(true));
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      pdf.setProperties({ title: "Конспект занятия" });
      for (let index = 0; index < pages.length; index++) {
        setStatus(`Готовим PDF: лист ${index + 1} из ${pages.length}`);
        if (index) pdf.addPage();
        const canvas = await renderPage(pages[index]);
        pdf.addImage(canvas.toDataURL("image/jpeg", .94), "JPEG", 8, 8, 194, 194 * PAGE_HEIGHT / PAGE_WIDTH);
        pdf.setFontSize(9); pdf.setTextColor(110);
        pdf.text(`${index + 1} / ${pages.length}`, 105, 291, { align: "center" });
        canvas.width = 0; canvas.height = 0;
      }
      await pdf.save(filename, { returnPromise: true });
      setStatus(`Конспект скачан: ${pages.length} стр.`);
    } catch { setStatus("Не удалось скачать PDF. Записи сохранены в браузере, попробуйте ещё раз."); }
    finally { setExporting(false); }
  };

  return <main className="whiteboard">
    <header className="board-header">
      <a href="/" className="board-back">← На сайт</a>
      <div><h1>Математическая доска</h1><p>Ручка — писать · ладошка — листать · два пальца — масштаб</p></div>
      <span className="board-badge">Пробная версия</span>
    </header>
    <div className="board-controls">
    <div className="board-toolbar" role="toolbar" aria-label="Инструменты доски">
      <div className="board-tools">{tools.map(([value, label, icon]) => <button key={value} type="button" className="board-tool" aria-pressed={tool === value} title={value === "eraser" ? "Ластик: стереть штрих или фигуру целиком" : value === "select" ? "Выбрать, переместить или изменить фигуру" : label} onClick={() => setTool(value)}><span aria-hidden="true">{icon === "hand" ? <HandIcon /> : icon}</span>{label}</button>)}
        <button type="button" className="board-tool" disabled={fileBusy} onClick={()=>fileInput.current?.click()}><span aria-hidden="true">↥</span>Загрузить файл</button>
        <input ref={fileInput} type="file" multiple hidden aria-label="Выбрать файлы с устройства" onChange={event=>{const files=[...event.target.files];event.target.value="";void importFiles(files);}}/>
        <details ref={figuresMenu} className="board-figures">
          <summary className={`board-tool ${activeFigure ? "is-active" : ""}`} aria-label="Фигуры"><span aria-hidden="true">◇</span>Фигуры <span className="board-figures-chevron" aria-hidden="true">⌄</span></summary>
          <div className="board-figures-panel" role="group" aria-label="Фигуры">
            {figureGroups.map(group => <div className="board-figure-group" role="group" aria-label={group.title} key={group.title}>
              <h2>{group.title}</h2>
              {group.figures.map(([value, label]) => <button key={value} type="button" className="board-tool" aria-label={isVisualization(value) ? `${label} — 3D-визуализация` : undefined} aria-pressed={tool === value} onClick={() => { if (isVisualization(value)) insertVisualization(value); else setTool(value); figuresMenu.current.open = false; figuresMenu.current.querySelector("summary")?.focus(); }}><FigureIcon type={value} />{label}</button>)}
            </div>)}
          </div>
        </details>
      </div>
      <div className={`board-options ${optionsOpen ? "is-open" : ""}`} id="board-drawing-options">
        <div className="board-colors" role="group" aria-label="Цвет">{colors.map(([value, label]) => <button key={value} type="button" style={{ "--swatch": value }} aria-label={label} aria-pressed={color === value} onClick={() => editStyle("color", value)} />)}</div>
        <label className="board-size">Толщина <input type="range" min="2" max="12" value={size} onChange={event => editStyle("size", Number(event.target.value))} /><output>{size}</output></label>
        <button type="button" className="board-action" aria-pressed={grid} onClick={() => setGrid(!grid)}>Клетка</button>
      </div>
    </div>
    <div className="board-mobile-view" role="group" aria-label="Масштаб листа">
      <div><button className="board-action" type="button" aria-label="Уменьшить лист" disabled={zoom<=1} onClick={()=>changeZoom(zoom-.25)}>−</button><button className="board-action board-zoom-reset" type="button" aria-label="Лист по ширине экрана" onClick={()=>changeZoom(1)}>{Math.round(zoom*100)}%</button><button className="board-action" type="button" aria-label="Приблизить лист" disabled={zoom>=4} onClick={()=>changeZoom(zoom+.25)}>+</button></div>
      <button className="board-action" type="button" aria-expanded={optionsOpen} aria-controls="board-drawing-options" onClick={()=>setOptionsOpen(!optionsOpen)}>Цвет и толщина {optionsOpen ? "⌃" : "⌄"}</button>
    </div>
    {tool === "select" && !(selectedItem && isVisualization(selectedItem.type)) && <div className="board-selection-bar" role="group" aria-label="Управление 3D-фигурой">
      {selectedItem?.type==="attachment" ? <button className="board-action" onClick={()=>{setFileNotice("");setOpenFile(selectedItem.id);}}>Открыть файл</button> : selectedItem?.type==="image" ? <span className="board-image-hint">Ладошка перемещает фото · уголки меняют размер</span> : <>
      <span>3D</span>
      <button className="board-action" type="button" disabled={!selectedSolid} aria-pressed={manipulation === "move"} onClick={()=>setManipulation("move")}>Перемещать</button>
      <button className="board-action" type="button" disabled={!selectedSolid} aria-pressed={manipulation === "rotate"} onClick={()=>setManipulation("rotate")}>⟳ Вращать</button>
      <button className="board-action" type="button" disabled={!selectedSolid} onClick={resetView}>Сбросить ракурс</button>
      </>}
      <span>{selectedItem && isVisualization(selectedItem.type) ? "Внутри — вращать · за заголовок — перемещать · уголки — размер" : "Тяните внутри рамки · уголки меняют размер"}</span>
    </div>}
    <div className="board-actions">
      <div><button className="board-action" type="button" disabled={!past.length} aria-label="Отменить" title="Отменить" onClick={undo}><span aria-hidden="true">↶</span><span className="board-history-label"> Отменить</span></button><button className="board-action" type="button" disabled={!future.length} aria-label="Повторить" title="Повторить" onClick={redo}><span aria-hidden="true">↷</span><span className="board-history-label"> Повторить</span></button><button className="board-action" type="button" disabled={pageCount >= 100} onClick={addPage}>+ Добавить лист</button><button className="board-action" type="button" disabled={pageCount<=1} onClick={()=>setDeletePage({mode:"single",from:String(pageCount),to:String(pageCount)})}><span aria-hidden="true">− </span>Удалить лист</button></div>
      <div><button className="board-action board-pdf-button" type="button" disabled={exporting} onClick={downloadPdf}>{exporting ? "Готовим PDF…" : "Скачать конспект PDF"}</button><button className="board-action" type="button" disabled={!items.length} onClick={() => setClearOpen(true)}>Очистить</button></div>
    </div>
    </div>
    <div className="board-workspace" ref={viewportRef} {...captureHandlers}>
      <div className="board-pages" style={{"--board-zoom":zoom}}>
      {Array.from({ length: pageCount }, (_, page) => <section className="board-page" key={page} aria-label={`Лист ${page + 1}`}>
      <h2 className="board-page-label">Лист {page + 1} <span>A4</span></h2>
      <svg ref={node => { sheets.current[page] = node; }} data-page-index={page} className={`board-paper ${tool === "eraser" ? "is-erasing" : tool === "select" ? `is-selecting ${manipulation === "rotate" ? "is-rotating" : ""}` : ""}`} viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`} aria-label={`Поле для рисования, лист ${page + 1}`} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
        <defs><pattern id={`board-grid-${page}`} width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse"><path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e2e9e4" strokeWidth="1" /></pattern></defs>
        <rect width={PAGE_WIDTH} height={PAGE_HEIGHT} fill="#ffffff" />
        {grid && <rect width={PAGE_WIDTH} height={PAGE_HEIGHT} fill={`url(#board-grid-${page})`} />}
        {[...items.filter(item=>item.page===page && item.id!==draft?.id),...(draft?.page===page ? [draft] : [])].sort((a,b)=>Number(b.type==="image")-Number(a.type==="image")).map(item=><Shape key={item.id} item={item} erase={item.id!==draft?.id && tool==="eraser"} onFileOpen={id=>{setFileNotice("");setOpenFile(id);}} selectable={tool==="select" || tool==="axes" && item.type==="axes"} visualization={visualizationProps(item)}/>)}
        {tool === "select" && items.filter(item => item.page === page && !isVisualization(item.type)).map(item => <SelectionHitArea key={item.id} item={draft?.id === item.id ? draft : item} scale={PAGE_WIDTH / (sheets.current[page]?.getBoundingClientRect().width || PAGE_WIDTH)} />)}
        {tool === "select" && (draft?.id === selectedId ? [draft] : items.filter(item => item.id === selectedId)).filter(item => item.page === page).map(item => <SelectionControls key={item.id} item={item} scale={PAGE_WIDTH / (sheets.current[page]?.getBoundingClientRect().width || PAGE_WIDTH)} />)}
        {tool === "axes" && (draft?.type === "axes" ? [draft] : items.filter(item => item.id === selectedAxesId)).filter(item => item.page === page && item.points.length === 2).map(item => <g key={item.id} data-axis-controls="true">
          {item.points.map(([x, y], index) => {
            const scale = PAGE_WIDTH / (sheets.current[page]?.getBoundingClientRect().width || PAGE_WIDTH);
            return <g key={index}>
              <circle cx={x} cy={y} r={22 * scale} fill="transparent" data-resize-id={item.id} data-handle-index={index} className="board-axis-handle" />
              <circle cx={x} cy={y} r={6 * scale} fill="#fbfaf6" stroke="#2f493f" strokeWidth={1.5 * scale} pointerEvents="none" />
            </g>;
          })}
        </g>)}
        <g data-brand-strip="true" aria-label="ulianaa.maths">
          <rect x={DRAW_WIDTH} width={BRAND_WIDTH} height={PAGE_HEIGHT} fill="#2f493f" />
          <text data-brand-handle="true" transform={`translate(${DRAW_WIDTH + BRAND_WIDTH / 2} ${PAGE_HEIGHT - 90}) rotate(-90)`} dominantBaseline="central" fill="#ffffff" fontFamily="Arial, sans-serif" fontSize="28" letterSpacing="2">ulianaa.maths</text>
        </g>
      </svg>
      </section>)}
      </div>
    </div>
    <footer className="board-footer"><span role="status">{status}</span><span>{tool === "select" ? "Выберите фигуру · потяните, чтобы переместить · уголки меняют размер" : tool === "eraser" ? "Ластик удаляет штрих или фигуру целиком" : tool === "axes" ? "Оси X и Y · потяните по листу; кружки по углам меняют размер" : activeFigure ? `${activeFigure[1]} · потяните по листу, чтобы нарисовать` : tool === "visualization" ? "Действия внутри 3D-окна · ладошка перемещает окно" : "Рисуйте мышью, пальцем или стилусом"}</span></footer>
    {fileNotice && <div className="board-file-notice" role="status"><span>{fileNotice}</span>{!fileBusy&&!expanding&&<button aria-label="Закрыть сообщение" onClick={()=>setFileNotice("")}>✕</button>}</div>}
    {viewedFile && <AttachmentViewer key={viewedFile.id} item={viewedFile} onClose={()=>setOpenFile(null)} onExpand={expandFile} expanding={expanding} expanded={items.filter(item=>item.documentId===viewedFile.id).length===viewedFile.pageCount}/>}
    {renamePoint && <div className="board-dialog-backdrop"><form className="board-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-point-title" onSubmit={savePointName}>
      <h2 id="rename-point-title">Название точки</h2>
      <label>Имя <input aria-label="Название точки" autoFocus onFocus={event=>event.target.select()} maxLength={8} value={pointName} aria-invalid={!!renameError} aria-describedby="point-name-help" onChange={event=>{setPointName(event.target.value);setRenameError("");}} /></label>
      {renamePoint.field==="freePoints" && <div className="board-coordinate-inputs">{["X","Y","Z"].map((axis,index)=><label key={axis}>{axis}<input aria-label={`Координата ${axis}`} type="number" step="any" min="-100" max="100" value={pointCoordinates[index]} onChange={event=>setPointCoordinates(values=>values.map((value,i)=>i===index ? event.target.value : value))}/></label>)}</div>}
      <p id="point-name-help" role={renameError ? "alert" : undefined}>{renameError || "До 8 букв, цифр или штрихов. Вершины фигуры не переименовываются."}</p>
      <div><button className="board-action" type="button" onClick={()=>setRenamePoint(null)}>Отмена</button><button className="board-action" type="submit">Сохранить</button></div>
    </form></div>}
    {deletePage !== null && <div className="board-dialog-backdrop"><form className="board-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-page-title" onSubmit={removePage}>
      <h2 id="delete-page-title">{deletePage.mode==="single" || deleteFrom===deleteTo ? `Удалить лист №${deleteFrom}?` : `Удалить листы №${deleteFrom}–${deleteTo}?`}</h2>
      <div className="board-delete-modes" role="group" aria-label="Какие листы удалить">
        <button className="board-action" type="button" aria-pressed={deletePage.mode==="single"} onClick={()=>setDeletePage(value=>({...value,mode:"single"}))}>Один лист</button>
        <button className="board-action" type="button" aria-pressed={deletePage.mode==="range"} onClick={()=>setDeletePage(value=>({...value,mode:"range"}))}>Диапазон</button>
      </div>
      <div className="board-delete-fields">
        <label>{deletePage.mode==="single" ? "Номер листа" : "С листа"}<select aria-label={deletePage.mode==="single" ? "Номер листа" : "С листа"} value={deletePage.from} onChange={event=>setDeletePage(value=>({...value,from:event.target.value}))}>{Array.from({length:pageCount},(_,index)=><option key={index} value={index+1}>Лист {index+1}</option>)}</select></label>
        {deletePage.mode==="range" && <label>По лист включительно<select aria-label="По лист включительно" value={deletePage.to} onChange={event=>setDeletePage(value=>({...value,to:event.target.value}))}>{Array.from({length:pageCount},(_,index)=><option key={index} value={index+1}>Лист {index+1}</option>)}</select></label>}
      </div>
      {!validDeletion ? <p role="alert">{deleteTo<deleteFrom ? "Конец диапазона должен быть не раньше его начала." : "На доске должен остаться хотя бы один лист."}</p> : <p>{deleteCount===1 ? `Лист №${deleteFrom} и записи на нём будут удалены.` : `Листы с №${deleteFrom} по №${deleteTo} и записи на них будут удалены.`} Действие можно отменить.</p>}
      <div><button className="board-action" type="button" autoFocus onClick={()=>setDeletePage(null)}>Нет</button><button className="board-action" type="submit" disabled={!validDeletion}>Да, удалить</button></div>
    </form></div>}
    {clearOpen && <div className="board-dialog-backdrop"><section className="board-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-board-title"><h2 id="clear-board-title">Очистить все листы?</h2><p>Все записи на листах будут удалены. Это действие можно отменить кнопкой «Отменить».</p><div><button className="board-action" type="button" autoFocus onClick={() => setClearOpen(false)}>Оставить рисунок</button><button className="board-action" type="button" onClick={() => { remember(itemsRef.current); update([]); setClearOpen(false); }}>Очистить доску</button></div></section></div>}
  </main>;
}
