import BoardIcon from "./board-icons.jsx";
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
  const sx=box.width ? width/box.width : box.height ? height/box.height : 1;
  const sy=box.height ? height/box.height : sx;
  return { ...item, points, ...(item.smoothing===2 && Number.isFinite(item.smoothingDistance) ? {smoothingDistance:item.smoothingDistance*Math.sqrt(sx*sy)} : {}) };
}

export function SelectionControls({ item, scale, onCrop }) {
  const { x, y, width, height } = shapeBounds(item);
  return <g data-selection-controls="true">
    <rect x={x - 5 * scale} y={y - 5 * scale} width={width + 10 * scale} height={height + 10 * scale} fill="none" stroke="#2f493f" strokeWidth={scale} strokeDasharray={`${5 * scale} ${4 * scale}`} pointerEvents="none" />
    {[[x,y], [x+width,y], [x+width,y+height], [x,y+height]].map(([cx,cy], index) => <g key={index}>
      <circle cx={cx} cy={cy} r={22 * scale} fill="transparent" data-select-corner={index} data-resize-id={item.id} className={`board-selection-handle corner-${index}`} />
      <rect x={cx - 5 * scale} y={cy - 5 * scale} width={10 * scale} height={10 * scale} rx={scale} fill="#fbfaf6" stroke="#2f493f" strokeWidth={1.5 * scale} pointerEvents="none" />
    </g>)}
    {item.type==="image"&&onCrop&&<g role="button" tabIndex={0} aria-label="Обрезать" className="board-image-crop-button" transform={`translate(${Math.max(8*scale,Math.min(1600-52*scale,x+width-44*scale))} ${Math.max(8*scale,y-52*scale)})`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onCrop();}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();onCrop();}}}>
      <title>Обрезать изображение</title>
      <rect width={44*scale} height={44*scale} rx={7*scale} fill="#fbfaf6" stroke="#91aa9a" strokeWidth={scale}/>
      <BoardIcon name="crop" x={12*scale} y={12*scale} width={20*scale} height={20*scale} color="#2f493f" pointerEvents="none"/>
    </g>}
  </g>;
}

export function SelectionHitArea({ item, scale }) {
  const { x, y, width, height } = shapeBounds(item);
  const padding = 7 * scale;
  return <rect data-selection-hit="true" data-select-id={item.id} x={x-padding} y={y-padding} width={width+padding*2} height={height+padding*2} fill="transparent" pointerEvents="all" />;
}
