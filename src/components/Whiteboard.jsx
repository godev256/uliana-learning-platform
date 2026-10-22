import {mergeNotebooks} from "../account/board-sync.js";
import BoardIcon from "./board-icons.jsx";
import DrawingToolSettings from "./board-tool-settings.jsx";
import ImageCrop from "./board-image-crop.jsx";
import { AttachmentViewer } from "./board-attachments.jsx";
import { storeAsset,readAsset,blobDataUrl } from "./board-assets.js";
import { pdfPageCount,pdfPageImage } from "./board-pdf.js";
import { eraserPolyline, eraserHits, cutInkPolyline, eraserCursor } from "./board-eraser.js";
import { appendStrokePoints } from "./board-strokes.js";
import { boardId } from "./board-id.js";
import { clipboardImage, validBoardImage } from "./board-images.js";
import { flushSync } from "react-dom";
import { sanitizeConstructions, sameReference, validSpatialPair, spatialPoint, nearestProjectedEdge, constructionReferences, nextPointLabel, spatialIntersections, planeGeometry, withoutConstruction, nearestCoordinateAxis, clippedSpatialLine, spatialLinePoints, beginDirectedExtension, dragDirectedExtension } from "./board-space.js";
import { visualizationLayout } from "./board-visualization.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import "./whiteboard.css";
import { useBoardViewport, BOARD_TOUCH_QUERY, BOARD_DEFAULT_ZOOM, BOARD_MIN_ZOOM } from "./use-board-viewport.js";
import { figures, figureGroups, drawableTools, BoardShape as Shape, FigureIcon, shapeBounds } from "./board-shapes.jsx";
import { resizedShape, SelectionControls, SelectionHitArea } from "./board-selection.jsx";
import { isSolid, isVisualization, sanitizeEdgePoints, sanitizeFreePoints, validPointLabel, pointLabelKey, vertexNames, solidType } from "./board-solids.js";

const STORAGE_KEY = "uliana-whiteboard-v1";
const NOTEBOOK_KEY = "uliana-whiteboard-v2";
const DRAW_WIDTH = 1600;
const GRID_SIZE = 50;
const BRAND_WIDTH = 80;
const PAGE_WIDTH = DRAW_WIDTH + BRAND_WIDTH;
const PAGE_HEIGHT = 2376;
const tools = [
  ["select", "Ладошка"], ["pen", "Ручка"], ["highlighter", "Выделитель"], ["eraser", "Ластик"],
  ["line", "Линия"],
];
const BOARD_CLIPBOARD = "application/x-uliana-board+json";
const CLIPBOARD_PREFIX = "uliana-board-selection:";
const typingTarget = target => !!target.closest?.("textarea, select, input:not([type='range']):not([type='checkbox']):not([type='radio']), [contenteditable]:not([contenteditable='false'])");
const inkItem = item => item && ["pen", "highlighter"].includes(item.type);
const colors = [["#212123", "Чёрный"], ["#2f493f", "Зелёный"], ["#3058a0", "Синий"], ["#b24838", "Красный"]];

const highlightColors = [["#83c98b", "Салатовый"], ["#f2d34f", "Жёлтый"], ["#76bce8", "Голубой"], ["#ed94b6", "Розовый"], ["#b79ade", "Сиреневый"]];

function constructionTarget(hit) {
  const target=hit?.closest("[data-free-point-id], [data-intersection-point-id], [data-edge-point-id], [data-spatial-line-id], [data-spatial-plane-id]");
  if (!target) return null;
  const kind=target.hasAttribute("data-free-point-id") ? "free" : target.hasAttribute("data-intersection-point-id") ? "intersection" : target.hasAttribute("data-edge-point-id") ? "point" : target.hasAttribute("data-spatial-line-id") ? "line" : "plane";
  const id=target.dataset.freePointId??target.dataset.intersectionPointId??target.dataset.edgePointId??target.dataset.spatialLineId??target.dataset.spatialPlaneId;
  return {kind,id,shapeId:target.closest("[data-shape-id]")?.dataset.shapeId};
}

function loadNotebook(source,storageKey=NOTEBOOK_KEY) {
  try {
    const notebook = source ?? JSON.parse(localStorage.getItem(storageKey));
    const stored = notebook?.items ?? (storageKey===NOTEBOOK_KEY ? JSON.parse(localStorage.getItem(STORAGE_KEY)) : []);
    if (!Array.isArray(stored) || stored.length > 10000) return { items: [], pageCount: 3 };
    const items = stored.filter(item => item && typeof item.id === "string" &&
      drawableTools.includes(item.type) && (item.type!=="image" || validBoardImage(item.src) || typeof item.assetId==="string") && (item.type!=="attachment" || typeof item.assetId==="string" && typeof item.name==="string" && item.name.length<=512 && ["pdf","file"].includes(item.format) && (item.format!=="pdf" || Number.isInteger(item.pageCount)&&item.pageCount>0)) &&
      /^#[0-9a-f]{6}$/i.test(item.color) && Number.isFinite(item.size) && item.size > 0 && item.size <= (item.type === "highlighter" ? 72 : 24) &&
      Array.isArray(item.points) && item.points.length && item.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))
      .map(item => ({ ...item, page: Number.isInteger(item.page) && item.page >= 0 && item.page < 100 ? item.page : 0,
        ...(item.type==="image"?{crop:item.crop&&['x','y','width','height'].every(key=>Number.isFinite(item.crop[key]))&&item.crop.x>=0&&item.crop.y>=0&&item.crop.width>0&&item.crop.height>0&&item.crop.x+item.crop.width<=1.000001&&item.crop.y+item.crop.height<=1.000001?item.crop:undefined}:{}),
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

export default function Whiteboard({initialNotebook,storageKey=NOTEBOOK_KEY,onNotebookChange,onNotebookPreview,syncNotebook,cloudStatus,topicsPanel,pdfMode=false,studentMode=false,backHref="/",backLabel="← На сайт"}) {
  const [initial] = useState(()=>loadNotebook(initialNotebook,storageKey));
  const [items, setItems] = useState(initial.items);
  const itemsRef = useRef(items);
  const syncedNotebook=useRef(syncNotebook);
  const [pageCount, setPageCount] = useState(initial.pageCount);
  const pageCountRef = useRef(pageCount);
  const fileInput=useRef(null);
  const [openFile,setOpenFile]=useState(null);
  const [cropId,setCropId]=useState(null);
  const [fileBusy,setFileBusy]=useState(false);
  const [fileNotice,setFileNotice]=useState("");
  const [expanding,setExpanding]=useState("");
  const importing=useRef(false);
  const [exporting, setExporting] = useState(false);
  const pendingPage = useRef(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [tool, setTool] = useState(studentMode ? "select" : "pen");
  const [color, setColor] = useState(colors[0][0]);
  const [size, setSize] = useState(3);
  const [highlightColor, setHighlightColor] = useState(highlightColors[0][0]);
  const [highlightSize, setHighlightSize] = useState(36);
  const [eraserSize,setEraserSize] = useState(24);
  const [eraserMode,setEraserMode] = useState("stroke");
  const [grid, setGrid] = useState(true);
  const [draft, setDraft] = useState(null);
  const [selectedAxesId, setSelectedAxesId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds,setSelectedIds] = useState([]);
  const [marquee,setMarquee] = useState(null);
  const [groupDraft,setGroupDraft] = useState(null);
  const lastSelectionPress=useRef(null);
  const pastedGroupSelection=useRef(null);
  const [manipulation, setManipulation] = useState("move");
  const [visualizationModes,setVisualizationModes] = useState({});
  const [extensionSelections,setExtensionSelections]=useState({});
  const [lineStarts,setLineStarts] = useState({});
  const [planeStarts,setPlaneStarts] = useState({});
  const [renamePoint,setRenamePoint] = useState(null);
  const [pointName,setPointName] = useState("");
  const [pointCoordinates,setPointCoordinates] = useState(["0","0","0"]);
  const [renameError,setRenameError] = useState("");
  const gesture = useRef(null);
  const strokeFrame = useRef(null);
  const cancelStrokeFrame = () => {
    if (strokeFrame.current !== null) cancelAnimationFrame(strokeFrame.current);
    strokeFrame.current = null;
  };
  useEffect(() => () => {
    if (strokeFrame.current !== null) cancelAnimationFrame(strokeFrame.current);
  }, []);
  const [optionsOpen,setOptionsOpen] = useState(false);
  const [settingsTool,setSettingsTool]=useState(null);
  const drawingButtons=useRef({});
  const closeToolSettings=useCallback(restoreFocus=>{setSettingsTool(null);if(restoreFocus)drawingButtons.current[settingsTool]?.focus();},[settingsTool]);
  useEffect(()=>{if(settingsTool&&settingsTool!==tool)setSettingsTool(null);},[tool,settingsTool]);
  const [defaultZoom]=useState(()=>studentMode&&window.matchMedia(BOARD_TOUCH_QUERY).matches?1:BOARD_DEFAULT_ZOOM);
  const {viewportRef,contentRef,viewportWidth,zoom,changeZoom,captureHandlers,startPan,movePan,endPan} = useBoardViewport(() => {
    if (gesture.current) {
      onNotebookPreview?.({items:gesture.current.before,pageCount:pageCountRef.current});
      update(gesture.current.before);
    }
    cancelStrokeFrame();
    gesture.current = null; lastSelectionPress.current=null; setDraft(null); setGroupDraft(null); setMarquee(null); setLineStarts({}); setPlaneStarts({});
  },defaultZoom,studentMode&&defaultZoom===1?96:0);
  const sheets = useRef([]);
  const figuresMenu = useRef(null);
  const activeFigure = figures.find(([value]) => value === tool);
  const [deletePage, setDeletePage] = useState(null);
  const [insertPage, setInsertPage] = useState(null);
  const deleteFrom=Number(deletePage?.from),deleteTo=Number(deletePage?.mode==="range" ? deletePage?.to : deletePage?.from);
  const deleteCount=deleteTo-deleteFrom+1;
  const validDeletion=!!deletePage && Number.isInteger(deleteFrom)&&Number.isInteger(deleteTo)&&deleteFrom>=1&&deleteTo<=pageCount&&deleteTo>=deleteFrom&&deleteCount<pageCount;
  const [status, setStatus] = useState("Сохраняется в этом браузере");
  const selectedItem = draft?.id === selectedId ? draft : items.find(item => item.id === selectedId);
  const viewedFile=items.find(item=>item.id===openFile && item.type==="attachment");
  const selectedSolid = tool === "select" && selectedItem && isSolid(selectedItem.type) && !isVisualization(selectedItem.type);

  const usingHighlighter = tool === "highlighter" || tool === "select" && selectedItem?.type === "highlighter";
  const activeColor = tool === "select" && selectedItem ? selectedItem.color : usingHighlighter ? highlightColor : color;
  const activeSize = tool === "select" && selectedItem ? selectedItem.size : usingHighlighter ? highlightSize : size;
  const displayedItems=items.map(item=>groupDraft?.find(row=>row.id===item.id)??item);
  const groupItems=displayedItems.filter(item=>selectedIds.includes(item.id));
  const groupBounds=rows=>{
    const boxes=rows.map(shapeBounds),x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y));
    return {x,y,width:Math.max(...boxes.map(box=>box.x+box.width))-x,height:Math.max(...boxes.map(box=>box.y+box.height))-y};
  };
  useEffect(()=>{setSelectedIds(pastedGroupSelection.current ?? []);pastedGroupSelection.current=null;setGroupDraft(null);setMarquee(null);lastSelectionPress.current=null;},[tool]);
  useEffect(()=>{if(tool!=="select")setCropId(null);},[tool]);
  const update = (value) => { itemsRef.current = value; setItems(value); };
  const updatePageCount = count => { pageCountRef.current = count; setPageCount(count); };
  const snapshot = () => ({ items: itemsRef.current, pageCount: pageCountRef.current });
  const remember = (savedItems, count = pageCountRef.current) => { setPast(history => [...history.slice(-49), { items: savedItems, pageCount: count }]); setFuture([]); };
  const editStyle = (key, value) => {
    if (tool !== "select") {
      if (usingHighlighter) { if (key === "color") setHighlightColor(value); else setHighlightSize(value); }
      else { if (key === "color") setColor(value); else setSize(value); }
    }
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
    const node=sheets.current[page]?.closest(".board-page"),viewport=viewportRef.current;
    if(node&&viewport)viewport.scrollTop+=node.getBoundingClientRect().top-viewport.getBoundingClientRect().top;
  };
  const insertBlankPage = index => {
    const count = pageCountRef.current;
    if (studentMode || count >= 100 || !Number.isInteger(index) || index < 0 || index > count || gesture.current || expanding || importing.current) return;
    remember(itemsRef.current);
    update(itemsRef.current.map(item => item.page >= index ? {...item, page:item.page + 1} : item));
    pendingPage.current = index;
    updatePageCount(count + 1);
    if (pdfMode) setGrid(true);
    setInsertPage(null); setSelectedId(null); setSelectedIds([]);
    setLineStarts({}); setPlaneStarts({}); setTool("pen");
  };
  const addPage = () => {
    if(studentMode)return;
    if (pdfMode) setInsertPage(0);
    else insertBlankPage(pageCountRef.current);
  };
  const removePage = event => {
    event.preventDefault();
    const count=pageCountRef.current,from=deleteFrom-1,to=deleteTo-1;
    if(studentMode || !validDeletion || to>=count || deleteCount>=count)return;
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
    setExtensionSelections(current=>({...current,[id]:null}));
    setPlaneStarts(starts=>({...starts,[id]:[]}));
    if (action === "reset") {
      remember(itemsRef.current);
      update(itemsRef.current.map(item=>item.id===id ? {...item,rotation:[0,0,0]} : item));
    } else setVisualizationModes(modes=>({...modes,[id]:action}));
  };
  const visualizationProps = item => ({mode:tool==="select" ? "move" : visualizationModes[item.id]??"rotate",lineStart:lineStarts[item.id],planeStart:planeStarts[item.id]??[],extensionId:extensionSelections[item.id],onAction:visualizationAction,scale:PAGE_WIDTH/(sheets.current[item.page]?.getBoundingClientRect().width||PAGE_WIDTH)});
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
    try { localStorage.setItem(storageKey, JSON.stringify({ items, pageCount })); if(!cloudStatus)setStatus("Сохранено в этом браузере"); }
    catch { setStatus("Не удалось сохранить. Скачайте PDF, чтобы не потерять записи."); }
    onNotebookChange?.({items,pageCount});
  }, [items, pageCount,storageKey,onNotebookChange]);

  useEffect(()=>{
    if(!syncNotebook||syncNotebook===syncedNotebook.current||gesture.current)return;
    const base=syncNotebook.base; syncedNotebook.current=syncNotebook;
    if(!base)return;
    const merged=mergeNotebooks(base,{items:itemsRef.current,pageCount:pageCountRef.current},syncNotebook.notebook);
    if(JSON.stringify(merged.items)!==JSON.stringify(itemsRef.current))update(merged.items);
    if(merged.pageCount!==pageCountRef.current)updatePageCount(merged.pageCount);
    setPast(history=>history.map(book=>mergeNotebooks(base,book,syncNotebook.notebook)));
    setFuture(history=>history.map(book=>mergeNotebooks(base,book,syncNotebook.notebook)));
  },[syncNotebook,draft]);
  useEffect(()=>{
    if(onNotebookPreview&&draft&&["rotate","extend-line"].includes(gesture.current?.mode))onNotebookPreview({items:itemsRef.current.map(item=>item.id===draft.id?draft:item),pageCount:pageCountRef.current});
  },[draft,onNotebookPreview]);

  useEffect(() => {
    const handle = event => {
      if (typingTarget(event.target) && event.key !== "Escape") return;
      if ((event.code === "KeyP" || event.key.toLowerCase() === "p") && !event.metaKey && !event.ctrlKey && !event.altKey && !event.isComposing && !gesture.current && !renamePoint && deletePage===null && insertPage===null && !openFile && !cropId && !expanding) {
        event.preventDefault();setTool("pen");setSettingsTool(null);setSelectedId(null);setSelectedIds([]);setSelectedAxesId(null);setLineStarts({});setPlaneStarts({});
        if(figuresMenu.current)figuresMenu.current.open=false;
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && tool === "select" && !studentMode && !gesture.current && !renamePoint && deletePage === null && insertPage === null && !openFile && !cropId && !expanding) {
        const ids = new Set(selectedIds.length ? selectedIds : [selectedId]);
        const removable = itemsRef.current.filter(item => ids.has(item.id) && !item.background);
        if (removable.length) {
          event.preventDefault(); remember(itemsRef.current);
          const deleted = new Set(removable.map(item => item.id));
          update(itemsRef.current.filter(item => !deleted.has(item.id)));
          setSelectedId(null); setSelectedIds([]); setSelectedAxesId(null);
          setLineStarts({}); setPlaneStarts({});
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !renamePoint && deletePage===null && insertPage===null && !openFile && !cropId) {
        event.preventDefault(); if (event.shiftKey) redo(); else undo();
      }
      if (event.key === "Escape") {
        if(expanding)return;
        setOpenFile(null);
        setCropId(null);
        setDeletePage(null);
        setInsertPage(null);
        setRenamePoint(null);
        setSelectedId(null);
        setSelectedIds([]);setMarquee(null);setGroupDraft(null);
        if(gesture.current?.mode==='marquee'||gesture.current?.mode==='group-move')gesture.current=null;
        setLineStarts({});
        setPlaneStarts({});
        if (figuresMenu.current?.open) { figuresMenu.current.open = false; figuresMenu.current.querySelector("summary")?.focus(); }
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });

  const pasteTarget = () => {
    const viewport=viewportRef.current.getBoundingClientRect();
    const top=window.matchMedia(BOARD_TOUCH_QUERY).matches ? viewport.top : document.querySelector(".board-controls").getBoundingClientRect().bottom;
    const bottom=Math.min(innerHeight,viewport.bottom);
    const page=sheets.current.map((node,index)=>({index,bounds:node.getBoundingClientRect()})).sort((a,b)=>Math.max(0,Math.min(b.bounds.bottom,bottom)-Math.max(b.bounds.top,top))-Math.max(0,Math.min(a.bounds.bottom,bottom)-Math.max(a.bounds.top,top)))[0];
    if(!page)return null;
    const visibleX=(Math.max(page.bounds.left,viewport.left)+Math.min(page.bounds.right,viewport.right))/2;
    const visibleY=(Math.max(page.bounds.top,top)+Math.min(page.bounds.bottom,bottom))/2;
    const scale=PAGE_WIDTH/page.bounds.width,center=[(visibleX-page.bounds.left)*scale,(visibleY-page.bounds.top)*scale];
    return {page, center};
  };
  useEffect(() => {
    const copy = event => {
      if (studentMode || typingTarget(event.target) || tool !== "select" || gesture.current || renamePoint || deletePage !== null || insertPage !== null || openFile || cropId) return;
      const ids = new Set(selectedIds.length ? selectedIds : [selectedId]);
      const selected = itemsRef.current.filter(item => ids.has(item.id) && !item.background);
      if (!selected.length || !event.clipboardData) return;
      const data = JSON.stringify({version:1,items:selected});
      event.clipboardData.setData(BOARD_CLIPBOARD, data);
      // Plain text survives clipboard transfers in browsers that strip custom MIME.
      event.clipboardData.setData("text/plain", CLIPBOARD_PREFIX + data);
      event.preventDefault();
    };
    window.addEventListener("copy", copy);
    return () => window.removeEventListener("copy", copy);
  });

  useEffect(() => {
    const paste = event => {
      if(studentMode || typingTarget(event.target) || gesture.current || renamePoint || deletePage!==null || insertPage!==null || openFile || cropId || expanding || importing.current)return;
      const clipboard = event.clipboardData;
      const text = clipboard?.getData("text/plain") ?? "";
      const data = clipboard?.getData(BOARD_CLIPBOARD) || (text.startsWith(CLIPBOARD_PREFIX) ? text.slice(CLIPBOARD_PREFIX.length) : "");
      if (data && data.length <= 8_000_000) {
        try {
          const payload = JSON.parse(data);
          if (payload.version === 1 && Array.isArray(payload.items) && payload.items.length && payload.items.length <= 10000) {
            const rows = loadNotebook({items:payload.items,pageCount:1}).items.filter(item => !item.background);
            const target = pasteTarget();
            if (rows.length && target) {
              event.preventDefault();
              const bounds = groupBounds(rows);
              const dx = Math.max(-bounds.x,Math.min(DRAW_WIDTH - bounds.x - bounds.width,target.center[0] - bounds.x - bounds.width / 2 + 24));
              const dy = Math.max(-bounds.y,Math.min(PAGE_HEIGHT - bounds.y - bounds.height,target.center[1] - bounds.y - bounds.height / 2 + 24));
              const copies = rows.map(item => ({...item,id:boardId(),page:target.page.index,points:item.points.map(([x,y])=>[x+dx,y+dy])}));
              if (tool !== "select") pastedGroupSelection.current = copies.length > 1 ? copies.map(item=>item.id) : [];
              remember(itemsRef.current); update([...itemsRef.current,...copies]); setTool("select");
              setSelectedId(copies.length === 1 ? copies[0].id : null);
              setSelectedIds(copies.length > 1 ? copies.map(item=>item.id) : []);
              return;
            }
          }
        } catch { /* Other clipboard contents can still contain an image. */ }
      }
      const files=[...(event.clipboardData?.items??[])].filter(item=>item.kind==="file" && /^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(item.type)).map(item=>item.getAsFile()).filter(Boolean);
      if(!files.length)return;
      event.preventDefault();
      const target = pasteTarget();
      if (!target) return;
      const {page, center} = target;
      void (async()=>{
        try {
          for(const file of files) {
            const image=await clipboardImage(file);
            if(page.index>=pageCountRef.current)continue;
            const ratio=Math.min(1,1200/image.width,1400/image.height),width=image.width*ratio,height=image.height*ratio;
            const x=Math.max(0,Math.min(DRAW_WIDTH-width,center[0]-width/2)),y=Math.max(0,Math.min(PAGE_HEIGHT-height,center[1]-height/2));
            const assetId=await storeAsset(await(await fetch(image.src)).blob());
            const item={id:boardId(),type:"image",page:page.index,color:"#212123",size:4,points:[[x,y],[x+width,y+height]],assetId};
            remember(itemsRef.current);update([...itemsRef.current,item]);setSelectedId(item.id);setTool("pen");
          }
        } catch {setStatus("Не удалось вставить изображение. Попробуйте скопировать скриншот ещё раз.");}
      })();
    };
    window.addEventListener("paste",paste);
    return ()=>window.removeEventListener("paste",paste);
  });

  const importFiles = async files => {
    if(studentMode || importing.current || !files.length)return;
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
    if(studentMode)return;
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

  const pointMapper = (event, clamp = true) => {
    // Read the current viewport bounds: SVG screen matrices can lag behind scrolling.
    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const cssWidth=parseFloat(style.width),rawBorders=(parseFloat(style.borderLeftWidth)||0)+(parseFloat(style.borderRightWidth)||0);
    const borderScale=cssWidth?bounds.width/(cssWidth+(style.boxSizing==="border-box"?0:rawBorders)):1;
    const left = (parseFloat(style.borderLeftWidth) || 0)*borderScale;
    const right = (parseFloat(style.borderRightWidth) || 0)*borderScale;
    const top = (parseFloat(style.borderTopWidth) || 0)*borderScale;
    const bottom = (parseFloat(style.borderBottomWidth) || 0)*borderScale;
    const width = bounds.width - left - right;
    const height = bounds.height - top - bottom;
    const scale = Math.min(width / PAGE_WIDTH, height / PAGE_HEIGHT);
    return sample => {
      const x = (sample.clientX - bounds.left - left - (width - PAGE_WIDTH * scale) / 2) / scale;
      const y = (sample.clientY - bounds.top - top - (height - PAGE_HEIGHT * scale) / 2) / scale;
      return clamp ? [Math.max(0, Math.min(DRAW_WIDTH, x)), Math.max(0, Math.min(PAGE_HEIGHT, y))] : [x,y];
    };
  };
  const point = event => pointMapper(event)(event);
  const sampleStroke = (event, current) => {
    const map = pointMapper(event);
    const native = event.nativeEvent ?? event;
    const samples = native.getCoalescedEvents?.() ?? [];
    // Include the dispatched event: some browsers omit its final position.
    const points = appendStrokePoints(current.item.points, [...samples, event].map(map));
    if (points !== current.item.points) current.item = { ...current.item, points };
  };
  const erase = event => {
    const current=gesture.current;
    if(!current || current.item.type!=="eraser")return;
    const map=pointMapper(event,false),native=event.nativeEvent??event;
    const samples=[...(native.getCoalescedEvents?.()??[]),event].map(map);
    const sweep=current.eraseLast ? [current.eraseLast,...samples] : samples;
    current.eraseLast=sweep.at(-1);
    // A constant screen radius remains easy to use when the sheet is zoomed out.
    const origin=map({clientX:0,clientY:0}),unit=map({clientX:1,clientY:0});
    const radius=current.eraserSize/2*Math.abs(unit[0]-origin[0]);
    const left=Math.min(...sweep.map(p=>p[0]))-radius,right=Math.max(...sweep.map(p=>p[0]))+radius;
    const top=Math.min(...sweep.map(p=>p[1]))-radius,bottom=Math.max(...sweep.map(p=>p[1]))+radius;
    current.eraseCandidates??=current.before.filter(item=>inkItem(item)&&!item.background&&item.page===current.item.page)
      .map(item=>({item,bounds:shapeBounds(item)}));
    const replacements=new Map(),candidates=[];
    for(const candidate of current.eraseCandidates){
      const {item,bounds}=candidate,padding=item.size/2;
      if(bounds.x-padding>right || bounds.x+bounds.width+padding<left || bounds.y-padding>bottom || bounds.y+bounds.height+padding<top){candidates.push(candidate);continue;}
      candidate.polyline??=eraserPolyline(item,current.eraserMode==="partial" ? .05 : .5);
      if(!eraserHits(candidate.polyline,sweep,radius+padding)){candidates.push(candidate);continue;}
      if(current.eraserMode!=="partial"){replacements.set(item.id,[]);continue;}
      const pieces=cutInkPolyline(candidate.polyline,sweep,radius+padding);
      if(pieces===null){candidates.push(candidate);continue;}
      const fragments=pieces.map((points,index)=>({...item,id:index===0?item.id:boardId(),points,smoothing:0,smoothingDistance:undefined}));
      replacements.set(item.id,fragments);
      candidates.push(...fragments.map(fragment=>({item:fragment,bounds:shapeBounds(fragment),polyline:fragment.points})));
    }
    current.eraseCandidates=candidates;
    if(replacements.size)update(itemsRef.current.flatMap(item=>replacements.get(item.id)??[item]));
  };
  const start = event => {
    if (event.button !== 0 || gesture.current || cropId || event.target.closest("[data-brand-strip]")) return;
    event.preventDefault();
    const page = Number(event.currentTarget.dataset.pageIndex);
    if(studentMode&&tool==="select"){setSelectedId(null);setSelectedIds([]);setSelectedAxesId(null);startPan(event);return;}
    if(tool==="select"){
      const previous=lastSelectionPress.current,now=performance.now();
      const twice=previous&&previous.page===page&&now-previous.time<450&&Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<16;
      lastSelectionPress.current={page,time:now,x:event.clientX,y:event.clientY};
      const groupHit=event.target.closest('[data-group-selection]');
      const objectHit=event.target.closest('[data-select-id], [data-shape-id], [data-resize-id]');
      if((twice&&!objectHit&&!groupHit)||(!objectHit&&!groupHit&&event.pointerType!=="touch"&&!window.matchMedia(BOARD_TOUCH_QUERY).matches)){
        event.currentTarget.setPointerCapture(event.pointerId);
        const origin=point(event);setSelectedId(null);setSelectedIds([]);setGroupDraft(null);
        gesture.current={mode:"marquee",pointerId:event.pointerId,before:itemsRef.current,page,start:origin,end:origin};
        setMarquee({page,x:origin[0],y:origin[1],width:0,height:0});return;
      }
      if(groupHit&&groupItems.length){
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current={mode:"group-move",pointerId:event.pointerId,before:itemsRef.current,originals:groupItems,start:point(event),dx:0,dy:0};
        return;
      }
      setSelectedIds([]);setGroupDraft(null);
    }
    const handle = event.target.closest("[data-resize-id]");
    const visualization = event.target.closest("[data-viz-body], [data-viz-header]");
    if(studentMode&&visualization?.hasAttribute("data-viz-header")){startPan(event);return;}
    if (!handle && visualization && (tool === "select" || tool === "visualization")) {
      const id = visualization.closest("[data-shape-id]")?.dataset.shapeId;
      const item = itemsRef.current.find(item => item.id === id && item.page === page);
      if (!item) return;
      flushSync(()=>setSelectedId(item.id));
      const mode = visualization.hasAttribute("data-viz-header") || tool==="select" ? "move" : visualizationModes[item.id]??"rotate";
      if(mode==="extend"){
        const {model}=visualizationLayout(item,shapeBounds(item)),position=point(event),scale=PAGE_WIDTH/(event.currentTarget.getBoundingClientRect().width||PAGE_WIDTH);
        const endpoint=event.target.closest('[data-extend-line-id]');
        if(endpoint){
          const line=(item.spatialLines??[]).find(row=>row.id===endpoint.dataset.extendLineId);if(!line)return;
          const projected=spatialLinePoints(item,line,model);if(!projected)return;
          event.currentTarget.setPointerCapture(event.pointerId);
          gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,base:item,item,mode:"extend-line",lineId:line.id,projected,grabPoint:position};return;
        }
        const references=[...constructionReferences(item),...(item.type==="viz-space"?[]:model.vertices.map((_,index)=>({kind:"vertex",index})))];
        const nearest=references.map(reference=>({reference,distance:Math.hypot(...spatialPoint(item,reference,model).map((value,index)=>value-position[index]))})).sort((a,b)=>a.distance-b.distance)[0];
        const label=event.target.closest('text'),pointHit=label?.closest('[data-construction-point-id]'),vertexHit=label?.closest('[data-vertex-index]');
        const reference=pointHit?{kind:pointHit.dataset.pointKind,id:pointHit.dataset.constructionPointId}:vertexHit?{kind:"vertex",index:Number(vertexHit.dataset.vertexIndex)}:nearest?.distance<=16*scale?nearest.reference:null;
        if(!reference)return;
        const first=lineStarts[item.id];
        if(!first){setLineStarts(current=>({...current,[item.id]:reference}));setExtensionSelections(current=>({...current,[item.id]:null}));return;}
        if(sameReference(first,reference)){setLineStarts(current=>({...current,[item.id]:null}));return;}
        const prepared=beginDirectedExtension(item,[first,reference],boardId());if(!prepared)return;
        const line=prepared.item.spatialLines.find(row=>row.id===prepared.lineId),projected=spatialLinePoints(prepared.item,line,model);if(!projected)return;
        setLineStarts(current=>({...current,[item.id]:null}));setExtensionSelections(current=>({...current,[item.id]:prepared.lineId}));
        event.currentTarget.setPointerCapture(event.pointerId);
        const changed=sanitizeConstructions(prepared.item);
        gesture.current={pointerId:event.pointerId,before:itemsRef.current,original:item,base:prepared.item,item:changed,mode:"extend-line",lineId:prepared.lineId,projected,grabPoint:position};setDraft(changed);return;
      }
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
    const map=pointMapper(event,false),origin=map({clientX:0,clientY:0}),unit=map({clientX:1,clientY:0});
    const smoothingDistance=2.25*Math.abs(unit[0]-origin[0]);
    if (tool === "axes") setSelectedAxesId(id);
    gesture.current = { pointerId: event.pointerId, before: itemsRef.current, eraserSize, eraserMode, item: { id, page, type: tool, color: tool === "highlighter" ? highlightColor : color, size: tool === "highlighter" ? highlightSize : size, points: [point(event)], ...(tool === "pen" ? { smoothing: 2, smoothingDistance } : tool === "highlighter" ? { smoothing: 1 } : {}) } };
    if (tool === "eraser") erase(event); else setDraft(gesture.current.item);
  };
  const move = event => {
    if (movePan(event)) return;
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if(current.mode==="marquee"){
      current.end=point(event);const [x,y]=current.start,[endX,endY]=current.end;
      setMarquee({page:current.page,x:Math.min(x,endX),y:Math.min(y,endY),width:Math.abs(endX-x),height:Math.abs(endY-y)});return;
    }
    if(current.mode==="group-move"){
      const next=point(event),box=groupBounds(current.originals);
      current.dx=Math.max(-box.x,Math.min(DRAW_WIDTH-box.x-box.width,next[0]-current.start[0]));
      current.dy=Math.max(-box.y,Math.min(PAGE_HEIGHT-box.y-box.height,next[1]-current.start[1]));
      setGroupDraft(current.originals.map(item=>({...item,points:item.points.map(([x,y])=>[x+current.dx,y+current.dy])})));return;
    }
    if (current.item.type === "eraser") { erase(event); return; }
    if (current.mode === "mark" || current.mode === "rename") {
      if (Math.hypot(event.clientX-current.clientStart[0],event.clientY-current.clientStart[1])>10) { current.cancelled = true; setDraft(null); }
      return;
    }
    if (!current.mode && current.resizeHandle === undefined && ["pen", "highlighter"].includes(current.item.type)) {
      sampleStroke(event, current);
      // Keep every input sample, but render at the display's refresh rate.
      if (strokeFrame.current === null) strokeFrame.current = requestAnimationFrame(() => {
        strokeFrame.current = null;
        if (gesture.current === current) setDraft(current.item);
      });
      return;
    }
    const next = point(event);
    if(current.mode==="extend-line"){
      current.item=dragDirectedExtension(current.base,current.lineId,current.projected,next,current.grabPoint);
      setDraft(current.item);return;
    }
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
      : ["pen", "highlighter"].includes(current.item.type) ? [...current.item.points, next] : [current.item.points[0], next] };
    setDraft(current.item);
  };
  const finish = event => {
    endPan(event);
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    cancelStrokeFrame();
    if (event.type !== "pointercancel" && !current.mode && current.resizeHandle === undefined && ["pen", "highlighter"].includes(current.item.type)) sampleStroke(event, current);
    if (event.type !== "pointercancel" && current.item?.type === "eraser") erase(event);
    gesture.current = null; setDraft(null);
    if (event.type === "pointercancel") { onNotebookPreview?.({items:current.before,pageCount:pageCountRef.current}); update(current.before);setMarquee(null);setGroupDraft(null);return; }
    if(current.mode==="marquee"){
      const [x,y]=current.start,[endX,endY]=current.end,left=Math.min(x,endX),top=Math.min(y,endY),right=Math.max(x,endX),bottom=Math.max(y,endY);
      const ids=Math.abs(endX-x)>5&&Math.abs(endY-y)>5?current.before.filter(item=>{if(item.page!==current.page||item.background)return false;const box=shapeBounds(item);return box.x>=left&&box.y>=top&&box.x+box.width<=right&&box.y+box.height<=bottom;}).map(item=>item.id):[];
      setSelectedIds(ids);setMarquee(null);return;
    }
    if(current.mode==="group-move"){
      if(Math.abs(current.dx)>.01||Math.abs(current.dy)>.01){
        const ids=new Set(current.originals.map(item=>item.id));remember(current.before);
        update(current.before.map(item=>ids.has(item.id)?{...item,points:item.points.map(([x,y])=>[x+current.dx,y+current.dy])}:item));
      }
      setGroupDraft(null);return;
    }
    if (current.mode === "rename") {
      if (!current.cancelled) requestAnimationFrame(()=>openPointEditor(current.original,current.reference));
      return;
    }
    if(current.mode==="extend-line"){
      current.item=dragDirectedExtension(current.base,current.lineId,current.projected,point(event),current.grabPoint);
      if(JSON.stringify(current.item.spatialLines)!==JSON.stringify(current.original.spatialLines)){remember(current.before);update(current.before.map(item=>item.id===current.item.id?current.item:item));}
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
  const renameAttachment=(id,name)=>{
    if(studentMode||!name.trim()||name.length>512)return false;
    const original=itemsRef.current.find(item=>item.id===id&&item.type==="attachment");
    if(!original)return false;
    if(original.name!==name){remember(itemsRef.current);update(itemsRef.current.map(item=>item.id===id?{...item,name}:item));}
    return true;
  };
  const applyImageCrop=area=>{
    const original=itemsRef.current.find(item=>item.id===cropId&&item.type==="image");if(!original){setCropId(null);return;}
    const box=shapeBounds(original),previous=original.crop??{x:0,y:0,width:1,height:1};
    const cropped={...original,crop:{x:previous.x+area.x*previous.width,y:previous.y+area.y*previous.height,width:area.width*previous.width,height:area.height*previous.height},points:[[box.x+area.x*box.width,box.y+area.y*box.height],[box.x+(area.x+area.width)*box.width,box.y+(area.y+area.height)*box.height]]};
    remember(itemsRef.current);update(itemsRef.current.map(item=>item.id===original.id?cropped:item));setCropId(null);
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

  return <main className={`whiteboard${studentMode?" is-student":""}`} style={{"--board-zoom":zoom,"--board-view-width":viewportWidth?`${viewportWidth}px`:"100%","--board-eraser-cursor":eraserCursor(eraserSize)}}>
    {settingsTool&&<DrawingToolSettings eraser={settingsTool==="eraser"} eraserMode={eraserMode} onEraserMode={setEraserMode} anchor={drawingButtons.current[settingsTool]} highlighter={settingsTool==="highlighter"} colors={settingsTool==="highlighter"?highlightColors:colors} color={activeColor} size={settingsTool==="eraser"?eraserSize:activeSize} onChange={settingsTool==="eraser"?(_key,value)=>setEraserSize(value):editStyle} onClose={closeToolSettings}/>}
    <div className="board-surface">
    <header className="board-header">
      <a href={backHref} className="board-back" aria-label={backLabel}><BoardIcon name="arrow-left"/>{backLabel.replace(/^←\s*/, "")}</a>
      <div><h1>Математическая доска</h1><p role={cloudStatus?"status":undefined}>{cloudStatus||"Ручка — писать · ладошка — листать · два пальца — масштаб"}</p></div>
      <span className="board-badge">{pdfMode?"Рабочий лист PDF":"Пробная версия"}</span>
    </header>
    <div className="board-controls">
    <div className="board-toolbar" role="toolbar" aria-label="Инструменты доски">
      <div className="board-tools">{tools.map(([value, label]) => <button key={value} ref={node=>{if(["pen","highlighter","eraser"].includes(value))drawingButtons.current[value]=node;}} type="button" className="board-tool" aria-label={label} aria-haspopup={["pen","highlighter","eraser"].includes(value)?"dialog":undefined} aria-expanded={["pen","highlighter","eraser"].includes(value)?settingsTool===value:undefined} aria-controls={settingsTool===value?"board-tool-settings":undefined} aria-pressed={tool === value} aria-keyshortcuts={value==="pen"?"P":undefined} title={value === "pen" ? "Ручка (P)" : value === "eraser" ? "Ластик: стереть ручку или выделение" : value === "select" && studentMode ? "Листать доску · масштаб двумя пальцами" : value === "select" ? "Выбрать и переместить · двойное нажатие и перетягивание — выделить область" : label} onClick={() => { setTool(value); setSettingsTool(["pen","highlighter","eraser"].includes(value) ? settingsTool===value?null:value : null); }}><span aria-hidden="true"><BoardIcon name={value==="select"?"hand":value}/></span></button>)}
        {studentMode&&<button className="board-tool board-touch-download" type="button" aria-label="Скачать доску PDF" title="Скачать доску PDF" disabled={exporting} onClick={downloadPdf}><BoardIcon name="download"/></button>}
        {!studentMode&&<><button type="button" className="board-tool" aria-label="Загрузить файл" title="Загрузить файл" disabled={fileBusy} onClick={()=>fileInput.current?.click()}><BoardIcon name="upload"/></button>
        <input ref={fileInput} type="file" multiple hidden aria-label="Выбрать файлы с устройства" onChange={event=>{const files=[...event.target.files];event.target.value="";void importFiles(files);}}/></>}
        {!studentMode&&<details ref={figuresMenu} className="board-figures">
          <summary className={`board-tool ${activeFigure ? "is-active" : ""}`} aria-label="Фигуры" title="Фигуры"><BoardIcon name="figures"/></summary>
          <div className="board-figures-panel" role="group" aria-label="Фигуры">
            {figureGroups.filter(group=>!pdfMode||!group.figures.some(([value])=>isVisualization(value))).map(group => <div className="board-figure-group" role="group" aria-label={group.title} key={group.title}>
              <h2>{group.title}</h2>
              {group.figures.map(([value, label]) => <button key={value} type="button" className="board-tool" aria-label={isVisualization(value) ? `${label} — 3D-визуализация` : undefined} aria-pressed={tool === value} onClick={() => { if (isVisualization(value)) insertVisualization(value); else setTool(value); figuresMenu.current.open = false; figuresMenu.current.querySelector("summary")?.focus(); }}><FigureIcon type={value} />{label}</button>)}
            </div>)}
          </div>
        </details>}
      </div>
      {!(studentMode&&tool==="select")&&!["pen","highlighter","eraser"].includes(tool)&&<div className={`board-options ${optionsOpen ? "is-open" : ""}`} id="board-drawing-options">
        <div className="board-colors" role="group" aria-label={usingHighlighter ? "Цвет выделителя" : "Цвет"}>{(usingHighlighter ? highlightColors : colors).map(([value, label]) => <button key={value} type="button" style={{ "--swatch": value }} aria-label={label} aria-pressed={activeColor === value} onClick={() => editStyle("color", value)} />)}</div>
        <label className="board-size">Толщина <input type="range" aria-label={usingHighlighter ? "Толщина выделителя" : "Толщина ручки"} min={usingHighlighter ? 16 : 2} max={usingHighlighter ? 72 : 12} value={activeSize} onChange={event => editStyle("size", Number(event.target.value))} /><output>{activeSize}</output></label>
      </div>}
      {!studentMode&&<button type="button" className="board-action board-grid-toggle" aria-pressed={grid} onClick={() => setGrid(!grid)}><BoardIcon name="grid"/><span>Клетка</span></button>}
    </div>
    <div className="board-mobile-view" role="group" aria-label="Масштаб листа">
      <div><button className="board-action" type="button" aria-label="Уменьшить лист" disabled={zoom<=BOARD_MIN_ZOOM} onClick={()=>changeZoom(zoom-.25)}><BoardIcon name="minus"/></button><button className="board-action board-zoom-reset" type="button" aria-label="Исходный размер листа" title={`Вернуть масштаб ${Math.round(defaultZoom*100)}%`} onClick={()=>changeZoom(defaultZoom)}>{Math.round(zoom*100)}%</button><button className="board-action" type="button" aria-label="Приблизить лист" disabled={zoom>=4} onClick={()=>changeZoom(zoom+.25)}><BoardIcon name="plus"/></button></div>
      {!(studentMode&&tool==="select")&&!["pen","highlighter","eraser"].includes(tool)&&<button className="board-action" type="button" aria-expanded={optionsOpen} aria-controls="board-drawing-options" onClick={()=>setOptionsOpen(!optionsOpen)}>Цвет и толщина <BoardIcon name={optionsOpen?"chevron-up":"chevron-down"}/></button>}
    </div>
    {!studentMode && tool === "select" && !groupItems.length && (selectedSolid || selectedItem?.type==="attachment") && selectedItem?.type!=="image" && (!pdfMode||selectedItem?.type==="attachment") && !(selectedItem && isVisualization(selectedItem.type)) && <div className="board-selection-bar" role="group" aria-label="Управление 3D-фигурой">
      {selectedItem?.type==="attachment" ? <button className="board-action" onClick={()=>{setFileNotice("");setOpenFile(selectedItem.id);}}>Открыть файл</button> : <>
      <span>3D</span>
      <button className="board-action" type="button" disabled={!selectedSolid} aria-pressed={manipulation === "move"} onClick={()=>setManipulation("move")}>Перемещать</button>
      <button className="board-action" type="button" disabled={!selectedSolid} aria-pressed={manipulation === "rotate"} onClick={()=>setManipulation("rotate")}><BoardIcon name="rotate"/>Вращать</button>
      <button className="board-action" type="button" disabled={!selectedSolid} onClick={resetView}>Сбросить ракурс</button>
      </>}
      <span>{selectedItem && isVisualization(selectedItem.type) ? "Внутри — вращать · за заголовок — перемещать · уголки — размер" : "Тяните внутри рамки · уголки меняют размер"}</span>
    </div>}
    {!studentMode&&tool==="select"&&groupItems.length>0&&<div className="board-selection-bar board-group-bar"><span>Выделено: {groupItems.length} · потяните внутри рамки</span><button type="button" className="board-action" onClick={()=>setSelectedIds([])}>Снять выделение</button></div>}
    <div className="board-actions">
      <div className="board-history" role="group" aria-label="История и листы"><button className="board-action" type="button" disabled={!past.length} aria-label="Отменить" title="Отменить" onClick={undo}><BoardIcon name="undo"/><span className="board-history-label"> Отменить</span></button><button className="board-action" type="button" disabled={!future.length} aria-label="Повторить" title="Повторить" onClick={redo}><BoardIcon name="redo"/><span className="board-history-label"> Повторить</span></button>{!studentMode&&<><button className="board-action" type="button" disabled={pageCount >= 100} onClick={addPage} aria-label="+ Добавить лист" title="Добавить лист"><BoardIcon name="plus"/><span>Добавить лист</span></button><button className="board-action" type="button" disabled={pageCount<=1} aria-label="Удалить лист" title="Удалить лист" onClick={()=>setDeletePage({mode:"single",from:String(pageCount),to:String(pageCount)})}><BoardIcon name="minus"/><span>Удалить лист</span></button></>}</div>
      <div className="board-export"><button className="board-action board-pdf-button" type="button" aria-label="Скачать конспект PDF" title="Скачать конспект PDF" disabled={exporting} onClick={downloadPdf}><BoardIcon name="download"/><span>{exporting ? "Готовим…" : "Конспект"}</span></button></div>
    </div>
    </div>
    <div className={`board-workspace${topicsPanel?" has-topics":""}`}>
      {topicsPanel}
      <div className="board-sheet-viewport" ref={viewportRef} {...captureHandlers}>
      <div className="board-sheet-stage"><div className="board-pages" ref={contentRef}>
      {Array.from({ length: pageCount }, (_, page) => <section className="board-page" key={page} aria-label={`Лист ${page + 1}`}>
      <h2 className="board-page-label">Лист {page + 1} <span>A4</span></h2>
      <svg ref={node => { sheets.current[page] = node; }} data-page-index={page} className={`board-paper ${tool === "highlighter" ? "is-highlighting" : ""} ${tool === "eraser" ? "is-erasing" : tool === "select" ? `is-selecting ${manipulation === "rotate" ? "is-rotating" : ""}` : ""}`} viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`} aria-label={`Поле для рисования, лист ${page + 1}`} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
        <defs><pattern id={`board-grid-${page}`} width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse"><path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e2e9e4" strokeWidth="1" /></pattern></defs>
        <rect width={PAGE_WIDTH} height={PAGE_HEIGHT} fill="#ffffff" />
        {grid && (!pdfMode || !items.some(item=>item.page===page && item.background)) && <rect data-page-grid="true" width={PAGE_WIDTH} height={PAGE_HEIGHT} fill={`url(#board-grid-${page})`} />}
        {[...displayedItems.filter(item=>item.page===page && item.id!==draft?.id),...(draft?.page===page ? [draft] : [])].sort((a,b)=>Number(b.type==="image")-Number(a.type==="image")).map(item=><Shape key={item.id} item={item} erase={inkItem(item) && !item.background && item.id!==draft?.id && tool==="eraser"} onFileOpen={id=>{setFileNotice("");setOpenFile(id);}} selectable={tool==="select" || tool==="axes" && item.type==="axes"} visualization={visualizationProps(item)}/>)}
        {!studentMode && tool === "select" && displayedItems.filter(item => item.page === page && !item.background && !isVisualization(item.type)).map(item => <SelectionHitArea key={item.id} item={draft?.id === item.id ? draft : item} scale={PAGE_WIDTH / (sheets.current[page]?.getBoundingClientRect().width || PAGE_WIDTH)} />)}
        {!studentMode && tool === "select" && !cropId && (draft?.id === selectedId ? [draft] : items.filter(item => item.id === selectedId)).filter(item => item.page === page).map(item => <SelectionControls key={item.id} item={item} onCrop={()=>setCropId(item.id)} scale={PAGE_WIDTH / (sheets.current[page]?.getBoundingClientRect().width || PAGE_WIDTH)} />)}
        {!studentMode&&tool==="select"&&groupItems.length>0&&groupItems[0].page===page&&(()=>{
          const box=groupBounds(groupItems),scale=PAGE_WIDTH/(sheets.current[page]?.getBoundingClientRect().width||PAGE_WIDTH),padding=6*scale;
          return <g data-selection-controls="true"><rect data-group-selection="true" x={box.x-padding} y={box.y-padding} width={box.width+padding*2} height={box.height+padding*2} fill="#2f493f" fillOpacity=".045" stroke="#2f493f" strokeWidth={scale} strokeDasharray={`${6*scale} ${4*scale}`} className="board-group-selection"/><text x={box.x} y={Math.max(16*scale,box.y-12*scale)} fill="#2f493f" fontSize={12*scale} pointerEvents="none">Выделено: {groupItems.length}</text></g>;
        })()}
        {!studentMode&&cropId&&items.filter(item=>item.id===cropId&&item.type==="image"&&item.page===page).map(item=><ImageCrop key={item.id} item={item} scale={PAGE_WIDTH/(sheets.current[page]?.getBoundingClientRect().width||PAGE_WIDTH)} pageWidth={PAGE_WIDTH} pageHeight={PAGE_HEIGHT} onApply={applyImageCrop} onClose={()=>setCropId(null)}/>)}
        {marquee?.page===page&&<rect data-selection-controls="true" data-marquee="true" x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} fill="#537361" fillOpacity=".1" stroke="#2f493f" strokeWidth={PAGE_WIDTH/(sheets.current[page]?.getBoundingClientRect().width||PAGE_WIDTH)} strokeDasharray="8 6" pointerEvents="none"/>}
        {!studentMode && tool === "axes" && (draft?.type === "axes" ? [draft] : items.filter(item => item.id === selectedAxesId)).filter(item => item.page === page && item.points.length === 2).map(item => <g key={item.id} data-axis-controls="true">
          {item.points.map(([x, y], index) => {
            const scale = PAGE_WIDTH / (sheets.current[page]?.getBoundingClientRect().width || PAGE_WIDTH);
            return <g key={index}>
              <circle cx={x} cy={y} r={22 * scale} fill="transparent" data-resize-id={item.id} data-handle-index={index} className="board-axis-handle" />
              <circle cx={x} cy={y} r={6 * scale} fill="#fbfaf6" stroke="#2f493f" strokeWidth={1.5 * scale} pointerEvents="none" />
            </g>;
          })}
        </g>)}
        <g data-brand-strip="true" aria-label="ulianaa-learning.pro">
          <rect x={DRAW_WIDTH} width={BRAND_WIDTH} height={PAGE_HEIGHT} fill="#2f493f" />
          <text data-brand-handle="true" transform={`translate(${DRAW_WIDTH + BRAND_WIDTH / 2} ${PAGE_HEIGHT - 90}) rotate(-90)`} dominantBaseline="central" fill="#D3E4D8" fontFamily="Golos Text, Arial, sans-serif" fontSize="28" letterSpacing="2">ulianaa-learning.pro</text>
        </g>
      </svg>
      </section>)}
      </div></div>
      </div>
    </div>
    <footer className="board-footer"><span role="status">{cloudStatus?"Доска привязана к аккаунту · сохранение на сервере":status}</span><span>{tool === "select" && studentMode ? "Тяните лист для прокрутки · два пальца — масштаб" : tool === "select" ? "Потяните на пустом месте для выделения рамкой · двойное нажатие и перетягивание тоже выделяет область" : tool === "eraser" ? (eraserMode==="partial"?"Стирает участок под кружком · настройки по кнопке ластика":"Стирает штрих целиком · настройки по кнопке ластика") : tool === "highlighter" ? "Проведите по записи, чтобы выделить её цветом" : tool === "axes" ? "Оси X и Y · потяните по листу; кружки по углам меняют размер" : activeFigure ? `${activeFigure[1]} · потяните по листу, чтобы нарисовать` : tool === "visualization" ? (studentMode?"Действия внутри 3D-окна · ладошка листает доску":"Действия внутри 3D-окна · ладошка перемещает окно") : "Рисуйте мышью, пальцем или стилусом"}</span></footer>
    </div>
    {fileNotice && <div className="board-file-notice" role="status"><span>{fileNotice}</span>{!fileBusy&&!expanding&&<button aria-label="Закрыть сообщение" onClick={()=>setFileNotice("")}><BoardIcon name="close"/></button>}</div>}

    {viewedFile && <AttachmentViewer key={viewedFile.id} item={viewedFile} onRename={studentMode?undefined:renameAttachment} onClose={()=>setOpenFile(null)} onExpand={!studentMode||items.filter(item=>item.documentId===viewedFile.id).length===viewedFile.pageCount?expandFile:undefined} expanding={expanding} expanded={items.filter(item=>item.documentId===viewedFile.id).length===viewedFile.pageCount}/>}
    {renamePoint && <div className="board-dialog-backdrop"><form className="board-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-point-title" onSubmit={savePointName}>
      <h2 id="rename-point-title">Название точки</h2>
      <label>Имя <input aria-label="Название точки" autoFocus onFocus={event=>event.target.select()} maxLength={8} value={pointName} aria-invalid={!!renameError} aria-describedby="point-name-help" onChange={event=>{setPointName(event.target.value);setRenameError("");}} /></label>
      {renamePoint.field==="freePoints" && <div className="board-coordinate-inputs">{["X","Y","Z"].map((axis,index)=><label key={axis}>{axis}<input aria-label={`Координата ${axis}`} type="number" step="any" min="-100" max="100" value={pointCoordinates[index]} onChange={event=>setPointCoordinates(values=>values.map((value,i)=>i===index ? event.target.value : value))}/></label>)}</div>}
      <p id="point-name-help" role={renameError ? "alert" : undefined}>{renameError || "До 8 букв, цифр или штрихов. Вершины фигуры не переименовываются."}</p>
      <div><button className="board-action" type="button" onClick={()=>setRenamePoint(null)}>Отмена</button><button className="board-action" type="submit">Сохранить</button></div>
    </form></div>}
    {!studentMode && insertPage !== null && <div className="board-dialog-backdrop"><form className="board-dialog" role="dialog" aria-modal="true" aria-labelledby="insert-page-title" onSubmit={event=>{event.preventDefault();insertBlankPage(Number(insertPage));}}>
      <h2 id="insert-page-title">Лист в клетку для заметок</h2>
      <label>Куда вставить лист<select aria-label="Куда вставить лист" autoFocus value={insertPage} onChange={event=>setInsertPage(Number(event.target.value))}>
        {Array.from({length:pageCount},(_,index)=><option key={index} value={index}>{index===0 ? "В начало доски" : `Перед листом ${index+1}`}</option>)}
        <option value={pageCount}>В конец доски</option>
      </select></label>
      <p>Страницы PDF и записи на них сохранятся. Вставку можно отменить.</p>
      <div><button className="board-action" type="button" onClick={()=>setInsertPage(null)}>Отмена</button><button className="board-action" type="submit">Вставить лист</button></div>
    </form></div>}
    {!studentMode && deletePage !== null && <div className="board-dialog-backdrop"><form className="board-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-page-title" onSubmit={removePage}>
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
  </main>;
}
