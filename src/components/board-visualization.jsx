import { CoordinateSpace } from "./board-coordinate-space.jsx";
import { projectSolid, solidType, vertexNames, vertexOrder } from "./board-solids.js";

import { clippedSpatialLine, spatialPoint, spatialIntersections, planeGeometry, clipPolygon, edgePreservingLinePaths, spatialDepthGaps } from "./board-space.js";

const labels = { space:"Координаты XYZ", cube: "Куб", cuboid: "Параллелепипед", tetrahedron: "Тетраэдр", prism: "Призма", pyramid: "Пирамида" };
export function visualizationLayout(item, {x,y,width,height}) {
  const header = Math.min(100,height*.13), actions = Math.min(162,height*.22);
  const planeChooser=0;
  const inset = Math.min(width,height)*.065;
  const model = projectSolid(item.type,item.rotation,{x:x+inset,y:y+header+actions+planeChooser+inset,width:width-2*inset,height:height-header-actions-planeChooser-2*inset},true,item.type==="viz-space" ? Math.max(3,Math.ceil(Math.max(0,...(item.freePoints??[]).map(point=>Math.hypot(...point.position))))) : 3);
  return {header,actions,planeChooser,inset,model};
}

// Labels and edge points share the model projection and therefore follow every rotation.
export function BoardVisualization({ item, box, mode="rotate", onAction, scale=1, erase=false, lineStart=null, extensionId=null, planeStart=[], workingPlane="xy" }) {
  const {x,y,width,height} = box;
  const deleting=erase || mode==="delete";
  const {header,actions,planeChooser,inset,model} = visualizationLayout(item,box);
  const fontSize = Math.min(40,width*.032);
  const buttonFont=Math.min(24,width*.02);
  const buttons = [["rotate","Вращать"],["reset","Сбросить ракурс"],["point","Точка на ребре"],["segment","Отрезок по точкам"],["extend","Продлить"],["intersection","Точка пересечения"],["plane","Плоскость через 3 точки"],["rename","Переименовать точку"],["parallel","Параллельная"]];
  const actionRows=3;
  const contentBox={x:x+inset*.3,y:y+header+actions+planeChooser+inset*.3,width:width-inset*.6,height:height-header-actions-planeChooser-inset*.9};
  const planes=(item.spatialPlanes??[]).map(plane=>{
    const geometry=planeGeometry(item,plane.through);
    return geometry ? {...plane,patch:clipPolygon(geometry.patch.map(model.projectPoint),contentBox),section:geometry.section.map(model.projectPoint)} : null;
  }).filter(Boolean);
  const depthRows=spatialDepthGaps(item,model,contentBox);
  const lineColors=["#466d85","#9a5a44","#667f70","#806491"];
  const center = [model.vertices.reduce((s,p)=>s+p[0],0)/model.vertices.length,model.vertices.reduce((s,p)=>s+p[1],0)/model.vertices.length];
  return <g data-shape-id={item.id} data-shape-type={item.type} pointerEvents="all" fontFamily="Golos Text, Arial, sans-serif">
    <rect x={x} y={y} width={width} height={height} rx={Math.min(32,width*.025)} fill="#ffffff" stroke="#c4d6cd" strokeWidth="3" />
    <g data-viz-header="true" style={{cursor:"move"}}>
      <rect x={x+2} y={y+2} width={width-4} height={header} rx="28" fill="#f0f5f1" />
      <text x={x+width*.035} y={y+header*.62} fill="#2f493f" fontSize={fontSize} fontWeight="600">3D-фигура · {labels[solidType(item.type)]}</text>
      <g className="board-viz-button" role="button" aria-label="Удалить построение" aria-pressed={mode==="delete"} tabIndex={0} data-viz-action="delete" data-viz-controls="true" style={{cursor:"pointer"}} onPointerDown={event=>event.stopPropagation()} onClick={()=>onAction?.(item.id,"delete")} onKeyDown={event=>{if(event.key==="Enter" || event.key===" "){event.preventDefault();onAction?.(item.id,"delete");}}}>
        <rect x={x+width*.72} y={y+header*.16} width={width*.25} height={header*.68} rx="10" fill={mode==="delete" ? "#f3e4de" : "#ffffff"} stroke={mode==="delete" ? "#bd9687" : "#d5e0d8"} strokeWidth="2" />
        <text x={x+width*.845} y={y+header*.52} dominantBaseline="central" textAnchor="middle" fill="#855f50" fontSize={fontSize*.8}>Удалить</text>
      </g>
    </g>
    <g data-viz-controls="true" role="group" aria-label={`Действия · ${labels[solidType(item.type)]}`} onPointerDown={event=>event.stopPropagation()}>
      <rect x={x+2} y={y+header} width={width-4} height={actions} fill="#fafcf9" />
      {buttons.map(([action,label],index)=>{const row=Math.floor(index/4),columns=4,column=index%4,buttonWidth=width*.94/columns;return <g key={action} className="board-viz-button" role="button" aria-label={action==="point" && item.type==="viz-space" ? "Добавить точку" : label} aria-pressed={action==="reset" ? undefined : mode===action} tabIndex={0} data-viz-action={action} style={{cursor:"pointer"}} onClick={()=>onAction?.(item.id,action)} onKeyDown={event=>{if(event.key==="Enter" || event.key===" "){event.preventDefault();onAction?.(item.id,action);}}}>
        <rect x={x+width*.03+column*buttonWidth} y={y+header+(row+.08)*actions/actionRows} width={buttonWidth-width*.008} height={actions*.84/actionRows} rx="10" fill={mode===action ? "#e0ebe2" : "#ffffff"} stroke={mode===action ? "#8ea99a" : "#d5e0d8"} strokeWidth="2" />
        <text x={x+width*.03+(column+.5)*buttonWidth} y={y+header+(row+.5)*actions/actionRows} dominantBaseline="central" textAnchor="middle" fill="#2f493f" fontSize={buttonFont}>{action==="plane" ? "Плоскость · 3 точки" : action==="segment" ? "Отрезок" : action==="rename" ? "Имя точки" : action==="point" && item.type==="viz-space" ? "Добавить точку" : label}</text>
      </g>;})}
      <path d={`M${x},${y+header+actions} H${x+width}`} stroke="#d8e3dc" strokeWidth="2" />
    </g>
    <g data-viz-body="true" style={{cursor:mode==="delete" ? "cell" : (mode==="extend" || mode==="point" || mode==="space-line" || mode==="segment" || mode==="intersection" || mode==="plane" || mode==="parallel" || mode==="rename") ? "var(--board-pen-cursor)" : "grab"}}>
      <rect x={x+2} y={y+header+actions+planeChooser+2} width={width-4} height={height-header-actions-planeChooser-4} fill="transparent" />
      {planes.filter(plane=>plane.patch.length>=3).map(plane=><g key={plane.id} data-spatial-plane-id={plane.id}>
        <polygon data-plane-patch="true" points={plane.patch.map(p=>p.join(",")).join(" ")} fill="#aa70b7" fillOpacity=".14" stroke="#9c69a8" strokeWidth="2" strokeDasharray="10 7" pointerEvents={deleting ? "all" : "none"} />
      </g>)}
      {item.type==="viz-space" ? <CoordinateSpace model={model} workingPlane="xy" fontSize={fontSize} clipBox={contentBox} clipId={`xyz-clip-${item.id}`}/> : <g pointerEvents="none" stroke={item.color} strokeWidth={item.size} strokeLinejoin="round">
        {model.faces.map((face,index) => <polygon key={index} points={face.points} fill={`hsl(150 22% ${80-Math.max(-1,Math.min(1,face.light))*17}%)`} />)}
        <path d={model.hidden} fill="none" strokeDasharray="12 10" strokeOpacity=".4" strokeWidth={Math.max(2,item.size*.65)} />
        <path d={model.visible} fill="none" />
      </g>}
      {planes.filter(plane=>item.type!=="viz-space" && plane.section.length>=3).map(plane=><g key={plane.id} data-spatial-plane-id={plane.id}>
        <polygon data-plane-section="true" points={plane.section.map(p=>p.join(",")).join(" ")} fill="#bf78ad" fillOpacity=".26" stroke="#8c427e" strokeWidth={Math.max(3,item.size)} strokeLinejoin="round" pointerEvents={deleting ? "all" : "none"} />
      </g>)}
      {item.type==="viz-space" && <g data-depth-guides="true" pointerEvents="none" clipPath={`url(#xyz-clip-${item.id})`}>
        {(item.freePoints??[]).filter(point=>Math.abs(point.position[2])>1e-8).map(point=>{
          const top=model.projectPoint(point.position),foot=model.projectPoint([point.position[0],point.position[1],0]);
          return <g key={point.id}><path d={`M${top} L${foot}`} fill="none" stroke="#8ea69a" strokeWidth="2" strokeDasharray="6 6"/><circle cx={foot[0]} cy={foot[1]} r={fontSize*.1} fill="#eef5f0" stroke="#8ea69a" strokeWidth="2"/></g>;
        })}
      </g>}
      {depthRows.sort((a,b)=>Number(a.line.kind==="segment")-Number(b.line.kind==="segment")).map(({line,segment,gaps})=>{
        const paths=edgePreservingLinePaths(item,line,segment),lineColor=lineColors[(item.spatialLines??[]).findIndex(row=>row.id===line.id)%lineColors.length];
        const maskId=`line-depth-${item.id}-${line.id}`;
        return <g key={line.id} data-spatial-line-id={line.id}>
          {gaps.length>0 && <defs><mask id={maskId} maskUnits="userSpaceOnUse" x={contentBox.x} y={contentBox.y} width={contentBox.width} height={contentBox.height}>
            <rect {...contentBox} fill="white"/>{gaps.map(([cx,cy],index)=><circle key={index} data-depth-gap="true" cx={cx} cy={cy} r={Math.max(item.size*2.4,5*scale)} fill="black"/>)}
          </mask></defs>}
          {(deleting || mode==="parallel" || mode==="extend") && <path d={`M${segment.ends[0]} L${segment.ends[1]}`} fill="none" stroke="transparent" strokeWidth={16*scale} />}
          <g mask={gaps.length?`url(#${maskId})`:undefined}>
          {line.kind==="segment" ? <path data-space-segment="true" d={`M${segment.ends[0]} L${segment.ends[1]}`} fill="none" stroke={lineColor} strokeWidth={Math.max(4,item.size)} pointerEvents="none" /> : <>
            <path data-space-line="true" data-edge-extension={line.kind==="edge-extension" ? "true" : undefined} d={paths.dashed} fill="none" stroke={lineColor} strokeOpacity=".65" strokeWidth={Math.max(2,item.size*.8)} strokeDasharray="10 7" pointerEvents="none" />
            {paths.solid && <path d={paths.solid} fill="none" stroke={lineColor} strokeWidth={Math.max(4,item.size)} pointerEvents="none" />}
          </>}
          </g>
          {mode==="extend"&&extensionId===line.id&&line.range&&segment.ends.map(([cx,cy],end)=><g key={end} data-viz-controls="true" data-extend-line-id={line.id} data-extend-end={end} style={{cursor:"ew-resize"}}><circle cx={cx} cy={cy} r={16*scale} fill="transparent"/><circle cx={cx} cy={cy} r={5*scale} fill="white" stroke={lineColor} strokeWidth={2*scale} pointerEvents="none"/></g>)}
        </g>;
      })}
      {mode==="point" && item.type!=="viz-space" && !deleting && model.edges.map(({pair:[a,b]})=><path key={`${a}-${b}`} data-viz-edge={`${a},${b}`} data-viz-controls="true" d={`M${model.vertices[a]} L${model.vertices[b]}`} fill="none" stroke="transparent" strokeWidth={20*scale} pointerEvents="none" />)}
      <g fill="#203e31" stroke="#ffffff" strokeWidth="6" paintOrder="stroke" fontSize={fontSize*.85} data-vertex-labels="true">
        {vertexOrder(item.type).map(index=>{
          const [vx,vy]=model.vertices[index];
          const dx=vx-center[0],dy=vy-center[1],length=Math.hypot(dx,dy)||1;
          return <g key={index} data-vertex-index={index} pointerEvents={(mode==="space-line" || mode==="segment" || mode==="plane" || mode==="parallel") && !deleting ? "all" : "none"}>
            {(mode==="space-line" || mode==="segment" || mode==="plane" || mode==="parallel") && !deleting && <circle cx={vx} cy={vy} r={14*scale} fill="transparent" stroke="none" data-viz-controls="true" />}
            <text data-vertex={vertexNames[solidType(item.type)][index]} x={vx+dx/length*fontSize*.6} y={vy+dy/length*fontSize*.6} textAnchor="middle" dominantBaseline="central">{vertexNames[solidType(item.type)][index]}</text>
          </g>;
        })}
      </g>
      {mode==="intersection" && !deleting && spatialIntersections(item).map((point,index)=>{
        const [px,py]=model.projectPoint(point.position);
        if (px<x+inset*.3 || px>x+width-inset*.3 || py<y+header+actions+planeChooser || py>y+height-inset*.3) return null;
        return <circle data-viz-controls="true" data-intersection-candidate={index} data-intersection-edge={point.edge?.join(",")} data-intersection-lines={point.lines.join(",")} key={index} cx={px} cy={py} r={fontSize*.3} fill="none" stroke="#aab8ac" strokeWidth="2" pointerEvents="none" />;
      })}
      {[...(item.edgePoints??[]).map(point=>({...point,kind:"point"})),...(item.intersectionPoints??[]).map(point=>({...point,kind:"intersection"})),...(item.freePoints??[]).map(point=>({...point,kind:"free"}))].map(point=>{
        const [px,py]=spatialPoint(item,{kind:point.kind,id:point.id},model);
        if (px<x || px>x+width || py<y+header+actions+planeChooser || py>y+height) return null;
        return <g key={point.id} data-construction-point-id={point.id} data-point-kind={point.kind} data-free-point-id={point.kind==="free" ? point.id : undefined} data-edge-point-id={point.kind==="point" ? point.id : undefined} data-intersection-point-id={point.kind==="intersection" ? point.id : undefined}>
          {(deleting || mode==="space-line" || mode==="segment" || mode==="plane" || mode==="parallel" || mode==="rename") && <circle cx={px} cy={py} r={16*scale} fill="transparent" />}
          <circle cx={px} cy={py} r={fontSize*.16} fill="#3058a0" stroke="white" strokeWidth="3" />
          <title>{point.kind==="free" ? `${point.label} (${point.position.join("; ")})` : point.label}</title>
          <text x={px+fontSize*.3} y={py-fontSize*.3} fill="#3058a0" stroke="white" strokeWidth="6" paintOrder="stroke" fontSize={fontSize*.85}>{point.label}</text>
        </g>;
      })}
      {planeStart.map((reference,index)=>{
        const projected=spatialPoint(item,reference,model);
        return projected && <circle key={index} data-viz-controls="true" data-plane-selection="true" cx={projected[0]} cy={projected[1]} r={fontSize*.3} fill="none" stroke="#a164a7" strokeWidth="4" pointerEvents="none" />;
      })}
      {lineStart && spatialPoint(item,lineStart,model) && <circle data-viz-controls="true" cx={spatialPoint(item,lineStart,model)[0]} cy={spatialPoint(item,lineStart,model)[1]} r={fontSize*.3} fill="none" stroke="#b77924" strokeWidth="4" pointerEvents="none" />}
      <text data-viz-controls="true" x={x+width/2} y={y+height-inset*.35} textAnchor="middle" fill="#63766b" fontSize={fontSize*.7} pointerEvents="none">{mode==="extend" ? "Нажмите на отрезок или ребро · потяните за концы продления" : mode==="delete" ? "Нажмите на прямую, отрезок, точку или плоскость" : mode==="parallel" ? (lineStart ? "Выберите прямую, отрезок, ребро или ось" : "Выберите точку, затем направление") : mode==="move" ? "Потяните внутри окна, чтобы переместить его" : (mode==="space-line" || mode==="segment") ? (lineStart ? "Выберите вторую точку" : "Выберите две точки или вершины") : mode==="plane" ? (planeStart.length===2 ? "Выберите третью точку вне прямой первых двух" : `Выберите ${planeStart.length ? "вторую" : "первую"} из трёх точек`) : mode==="intersection" ? "Нажмите на пересечение прямых или прямой с ребром" : mode==="rename" ? "Нажмите на вашу точку, чтобы изменить имя" : mode==="point" ? (item.type==="viz-space" ? "Нажмите на ось X, Y или Z · шаг 0,25" : "Нажмите на ребро — точка закрепится на нём") : "Потяните внутри окна, чтобы вращать фигуру"}</text>
    </g>
  </g>;
}
