import { isVisualization } from "./board-solids.js";
import { shapeBounds } from "./board-shapes.jsx";

export function resizedShape(item, corner, point, maxWidth, maxHeight) {
  const box = shapeBounds(item);
  const left = corner === 0 || corner === 3;
  const top = corner === 0 || corner === 1;
  const anchor = [left ? box.x + box.width : box.x, top ? box.y + box.height : box.y];
  const availableWidth = left ? anchor[0] : maxWidth - anchor[0];
  const availableHeight = top ? anchor[1] : maxHeight - anchor[1];
  let width = Math.min(availableWidth, Math.max(isVisualization(item.type) ? 600 : 20, left ? anchor[0] - point[0] : point[0] - anchor[0]));
  let height = Math.min(availableHeight, Math.max(isVisualization(item.type) ? 480 : 20, top ? anchor[1] - point[1] : point[1] - anchor[1]));
  if (["square", "cube", "triangle-equilateral", "image"].includes(item.type)) {
    const ratio = item.type === "image" ? box.height / (box.width || 1) : item.type === "triangle-equilateral" ? Math.sqrt(3) / 2 : 1;
    width = Math.min(width, height / ratio); height = width * ratio;
  }
  const x = left ? anchor[0] - width : anchor[0], y = top ? anchor[1] - height : anchor[1];
  const points = ["pen", "highlighter", "line"].includes(item.type)
    ? item.points.map(([px, py]) => [x + (box.width ? (px - box.x) / box.width : .5) * width, y + (box.height ? (py - box.y) / box.height : .5) * height])
    : [[x, y], [x + width, y + height]];
  return { ...item, points };
}

export function SelectionControls({ item, scale, onCrop }) {
  const { x, y, width, height } = shapeBounds(item);
  return <g data-selection-controls="true">
    <rect x={x - 5 * scale} y={y - 5 * scale} width={width + 10 * scale} height={height + 10 * scale} fill="none" stroke="#2f493f" strokeWidth={scale} strokeDasharray={`${5 * scale} ${4 * scale}`} pointerEvents="none" />
    {item.type==="image"&&onCrop&&<g role="button" tabIndex={0} aria-label="Обрезать" className="board-image-crop-button" transform={`translate(${Math.max(8*scale,Math.min(1600-118*scale,x+width-110*scale))} ${Math.max(8*scale,y-52*scale)})`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onCrop();}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();onCrop();}}}>
      <rect width={110*scale} height={44*scale} rx={7*scale} fill="#fbfaf6" stroke="#91aa9a" strokeWidth={scale}/>
      <text x={55*scale} y={22*scale} dominantBaseline="central" textAnchor="middle" fontSize={13*scale} fill="#2f493f" fontFamily="Arial, sans-serif" pointerEvents="none">Обрезать</text>
    </g>}
    {[[x,y], [x+width,y], [x+width,y+height], [x,y+height]].map(([cx,cy], index) => <g key={index}>
      <circle cx={cx} cy={cy} r={22 * scale} fill="transparent" data-select-corner={index} data-resize-id={item.id} className={`board-selection-handle corner-${index}`} />
      <rect x={cx - 5 * scale} y={cy - 5 * scale} width={10 * scale} height={10 * scale} rx={scale} fill="#fbfaf6" stroke="#2f493f" strokeWidth={1.5 * scale} pointerEvents="none" />
    </g>)}
  </g>;
}

export function SelectionHitArea({ item, scale }) {
  const { x, y, width, height } = shapeBounds(item);
  const padding = 7 * scale;
  return <rect data-selection-hit="true" data-select-id={item.id} x={x-padding} y={y-padding} width={width+padding*2} height={height+padding*2} fill="transparent" pointerEvents="all" />;
}

export function HandIcon() {
  return <svg width="22" height="24" viewBox="0 0 24 26" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 14V5a1.5 1.5 0 0 1 3 0v7-9a1.5 1.5 0 0 1 3 0v9-8a1.5 1.5 0 0 1 3 0v9-6a1.5 1.5 0 0 1 3 0v9c0 4-2 7-5 8H9c-2-1-3-3-4-5l-3-5a1.7 1.7 0 0 1 2.7-2L7 15" />
  </svg>;
}
