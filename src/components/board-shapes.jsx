import { memo, useMemo } from "react";
import { strokePath } from "./board-strokes.js";
import { AssetImage,FileCard } from "./board-attachments.jsx";
import { isSolid, isVisualization, solidType, projectSolid } from "./board-solids.js";

import { BoardVisualization } from "./board-visualization.jsx";

export const figureGroups = [
  { title: "2D · Плоские фигуры", figures: [
    ["axes", "Оси X и Y"],
    ["rect", "Прямоугольник"], ["square", "Квадрат"], ["ellipse", "Овал"],
    ["triangle-scalene", "Произвольный треугольник"],
    ["triangle", "Равнобедренный треугольник"],
    ["triangle-equilateral", "Равносторонний треугольник"],
    ["parallelogram", "Параллелограмм"], ["rhombus", "Ромб"],
    ["trapezoid-isosceles", "Равнобедренная трапеция"],
    ["trapezoid-right", "Прямоугольная трапеция"],
    ["trapezoid-scalene", "Произвольная трапеция"],
  ] },
  { title: "3D · Объёмные фигуры", figures: [
    ["cube", "Куб"], ["cuboid", "Параллелепипед"], ["tetrahedron", "Тетраэдр"],
    ["prism", "Призма"], ["pyramid", "Пирамида"],
  ] },
];
figureGroups.push({ title: "3D-визуализация фигур", figures: figureGroups[1].figures.map(([type,label]) => [`viz-${type}`,label]) });
figureGroups.at(-1).figures.unshift(["viz-space","Координатное пространство XYZ"]);
export const figures = figureGroups.flatMap(group => group.figures);
export const drawableTools = ["pen", "highlighter", "line", "image", "attachment", ...figures.map(([value]) => value)];

export function shapeBounds(item) {
  const first = item.points[0];
  let last = item.points.at(-1);
  if (item.type === "square" || item.type === "cube") {
    const side = Math.min(Math.abs(last[0] - first[0]), Math.abs(last[1] - first[1]));
    last = [first[0] + Math.sign(last[0] - first[0]) * side, first[1] + Math.sign(last[1] - first[1]) * side];
  }
  if (item.type === "triangle-equilateral") {
    const width = Math.min(Math.abs(last[0] - first[0]), Math.abs(last[1] - first[1]) * 2 / Math.sqrt(3));
    last = [first[0] + Math.sign(last[0] - first[0]) * width, first[1] + Math.sign(last[1] - first[1]) * width * Math.sqrt(3) / 2];
  }
  if (item.type === "pen" || item.type === "highlighter") {
    let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
    for (const [px, py] of item.points) {
      x = Math.min(x, px); y = Math.min(y, py);
      right = Math.max(right, px); bottom = Math.max(bottom, py);
    }
    return { x, y, width: right - x, height: bottom - y };
  }
  return { x: Math.min(first[0], last[0]), y: Math.min(first[1], last[1]), width: Math.abs(last[0] - first[0]), height: Math.abs(last[1] - first[1]) };
}

function BoardShapeContent({ item, erase = false, preview = false, selectable = false, visualization = {},onFileOpen }) {
  const first = item.points[0], last = item.points.at(-1);
  const freehand = item.type === "pen" || item.type === "highlighter";
  const { x, y, width, height } = freehand ? {} : shapeBounds(item);
  const props = { stroke: item.color, strokeWidth: item.size, opacity: item.type === "highlighter" ? 0.3 : undefined, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", "data-shape-id": preview ? undefined : item.id, "data-shape-type": preview ? undefined : item.type, pointerEvents: erase || selectable ? "stroke" : "none" };
  if(item.type==="image"&&item.crop)return <svg data-shape-id={item.id} data-shape-type="image" x={x} y={y} width={width} height={height} viewBox={`${item.crop.x} ${item.crop.y} ${item.crop.width} ${item.crop.height}`} preserveAspectRatio="none" overflow="hidden" pointerEvents={erase?"all":"none"}><AssetImage assetId={item.assetId} src={item.src} width="1" height="1" preserveAspectRatio="none"/></svg>;
  if (item.type === "image") return <AssetImage assetId={item.assetId} src={item.src} data-shape-id={item.id} data-shape-type="image" x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid meet" pointerEvents={erase ? "all" : "none"} />;
  if (item.type === "attachment") return <FileCard item={item} box={{x,y,width,height}} onOpen={onFileOpen} selectable={selectable} erase={erase}/>;
  if (item.type === "rect" || item.type === "square") return <rect {...props} x={x} y={y} width={width} height={height} />;
  if (item.type === "ellipse") return <ellipse {...props} cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} />;
  if (["triangle", "triangle-scalene", "triangle-equilateral"].includes(item.type)) return <polygon {...props} points={`${x + width * (item.type === "triangle-scalene" ? .22 : .5)},${y} ${x + width},${y + height} ${x},${y + height}`} />;
  if (item.type === "rhombus") return <polygon {...props} points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} />;
  if (item.type === "parallelogram") return <polygon {...props} points={`${x + width * .25},${y} ${x + width},${y} ${x + width * .75},${y + height} ${x},${y + height}`} />;
  if (item.type.startsWith("trapezoid-")) {
    const [left, right] = item.type === "trapezoid-isosceles" ? [.25, .75] : item.type === "trapezoid-right" ? [0, .65] : [.12, .62];
    return <polygon {...props} points={`${x + width * left},${y} ${x + width * right},${y} ${x + width},${y + height} ${x},${y + height}`} />;
  }
  if (isVisualization(item.type) && !preview) return <BoardVisualization item={item} box={{x,y,width,height}} erase={erase} {...visualization} />;
  if (isSolid(item.type)) {
    const paths = projectSolid(item.type,item.rotation,{x,y,width,height});
    return <g {...props}>
      <path d={paths.hidden} strokeDasharray={`${item.size * 3} ${item.size * 2}`} />
      <path d={paths.visible} />
    </g>;
  }
  if (item.type === "axes") {
    const cx = x + width / 2, cy = y + height / 2;
    const arrow = Math.min(18, width * .13, height * .13);
    const label = Math.min(32, width * .18, height * .18);
    return <g {...props}>
      <path d={`M${x},${cy} H${x + width} M${cx},${y + height} V${y}`} />
      <path d={`M${x + width - arrow},${cy - arrow / 2} L${x + width},${cy} L${x + width - arrow},${cy + arrow / 2} M${cx - arrow / 2},${y + arrow} L${cx},${y} L${cx + arrow / 2},${y + arrow}`} />
      <g fill={item.color} stroke="none" fontFamily="Golos Text, Arial, sans-serif" fontSize={label} pointerEvents="none">
        <text x={x + width - label * .8} y={cy - label * .5}>X</text>
        <text x={cx + label * .4} y={y + label}>Y</text>
        <text x={cx + label * .3} y={cy + label * 1.1}>0</text>
      </g>
      {(selectable || erase) && <path d={`M${x},${cy} H${x + width} M${cx},${y + height} V${y}`} stroke="transparent" strokeWidth={Math.max(28, item.size)} />}
    </g>;
  }
  if (item.type === "line") return <line {...props} x1={first[0]} y1={first[1]} x2={last[0]} y2={last[1]} />;
  return <InkPath item={item} pathProps={props} />;
}

function InkPath({ item, pathProps }) {
  const d = useMemo(() => strokePath(item.points, item.smoothing, item.smoothingDistance), [item.points, item.smoothing, item.smoothingDistance]);
  return <path {...pathProps} d={d} />;
}

// Static page content does not change while another stroke is being drawn.
export const BoardShape = memo(BoardShapeContent, (previous, next) =>
  !isVisualization(next.item.type) && next.item.type!=="attachment" && previous.item === next.item &&
  previous.erase === next.erase && previous.preview === next.preview && previous.selectable === next.selectable);

export function FigureIcon({ type }) {
  if (type==="viz-space") return <svg className="board-figure-icon" viewBox="0 0 100 80" aria-hidden="true"><path d="M12 60 H90 M45 70 V8 M45 60 L77 22" fill="none" stroke="currentColor" strokeWidth="3"/><text x="82" y="53" fontSize="18" fill="currentColor">x</text><text x="28" y="18" fontSize="18" fill="currentColor">z</text></svg>;
  return <svg className="board-figure-icon" viewBox="0 0 100 80" aria-hidden="true"><BoardShape item={{ id: "preview", type: solidType(type), points: [[7,7],[93,73]], color: "#2f493f", size: 3 }} preview /></svg>;
}
