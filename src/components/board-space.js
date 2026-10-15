import { solidGeometry, solidEdges, validPointLabel, pointLabelKey } from "./board-solids.js";

export function spatialPoint(item, reference, projection=solidGeometry(item.type).vertices) {
  const vertices=Array.isArray(projection) ? projection : projection.vertices;
  if (reference?.kind === "vertex") return vertices[reference.index];
  if (reference?.kind === "free") {
    const point=item.freePoints?.find(point=>point.id===reference.id);
    if (!point) return null;
    return projection.projectPoint ? projection.projectPoint(point.position) : point.position;
  }
  if (reference?.kind === "intersection") {
    const point=item.intersectionPoints?.find(point=>point.id===reference.id);
    if (!point) return null;
    return projection.projectPoint ? projection.projectPoint(point.position) : point.position;
  }
  const point = item.edgePoints?.find(point=>point.id===reference?.id);
  if (reference?.kind !== "point" || !point) return null;
  const a=vertices[point.edge[0]],b=vertices[point.edge[1]];
  return a.map((value,index)=>value+(b[index]-value)*point.t);
}
export const constructionReferences = item => [...(item.freePoints??[]).map(point=>({kind:"free",id:point.id})),...(item.edgePoints??[]).map(point=>({kind:"point",id:point.id})),...(item.intersectionPoints??[]).map(point=>({kind:"intersection",id:point.id}))];
export function nextPointLabel(item) {
  const points=[...(item.edgePoints??[]),...(item.intersectionPoints??[]),...(item.freePoints??[])],names=["M","N","P","Q","R","S","T","U","V","W","K","L"];
  let index=0,label;
  do {label=names[index%names.length]+(index>=names.length ? Math.floor(index/names.length) : "");index++;} while(points.some(point=>pointLabelKey(point.label)===pointLabelKey(label)));
  return label;
}
export const sameReference = (a,b) => a?.kind===b?.kind && (a?.kind==="vertex" ? a.index===b.index : a?.id===b?.id);
export function validSpatialPair(item, through) {
  if (!Array.isArray(through) || through.length!==2 || sameReference(...through)) return false;
  const valid=reference=>reference && (reference.kind==="vertex" ? Number.isInteger(reference.index) && reference.index>=0 && reference.index<solidGeometry(item.type).vertices.length : (reference.kind==="point" || reference.kind==="intersection" || reference.kind==="free") && typeof reference.id==="string" && (reference.kind==="point" ? item.edgePoints??[] : reference.kind==="free" ? item.freePoints??[] : item.intersectionPoints??[]).some(point=>point.id===reference.id));
  if (!through.every(valid)) return false;
  const [a,b]=through.map(reference=>spatialPoint(item,reference));
  return Math.hypot(...a.map((value,index)=>value-b[index]))>1e-8;
}
export function nearestProjectedEdge(model,position) {
  let nearest=null;
  for (const edge of model.edges) {
    const a=model.vertices[edge.pair[0]],b=model.vertices[edge.pair[1]],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((position[0]-a[0])*dx+(position[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    const distance=Math.hypot(position[0]-a[0]-dx*t,position[1]-a[1]-dy*t);
    if (!nearest || distance<nearest.distance-1e-6 || (Math.abs(distance-nearest.distance)<1e-6 && edge.visible && !nearest.visible)) nearest={...edge,t,distance};
  }
  return nearest;
}
const validLineKind = (item,line) => !line.kind || line.kind==="segment" || line.kind==="edge-extension" && line.through.every(ref=>ref.kind==="vertex") && solidGeometry(item.type).faces.some(face=>face.some((vertex,index)=>vertex===line.through[0].index && (face[(index+1)%face.length]===line.through[1].index || face[(index+face.length-1)%face.length]===line.through[1].index)));
export const sanitizeSpatialLines = item => Array.isArray(item.spatialLines) ? item.spatialLines.slice(0,200).filter(line=>line && typeof line.id==="string" && (line.kind==="parallel" ? !!spatialLinePoints(item,line) : validSpatialPair(item,line.through) && validLineKind(item,line))) : [];

// Resolve directions in world coordinates so parallel constructions survive camera rotation.
export function spatialLinePoints(item,line,projection=null,seen=new Set()) {
  if (!line || seen.has(line.id)) return null;
  const chain=new Set(seen); if(line.id)chain.add(line.id);
  let points;
  if(line.kind!=="parallel") {
    if(!validSpatialPair(item,line.through) || !validLineKind(item,line))return null;
    points=line.through.map(ref=>spatialPoint(item,ref));
  } else {
    if(!Array.isArray(line.through) || line.through.length!==1)return null;
    const ref=line.through[0];
    if(!ref || !(ref.kind==="vertex" ? Number.isInteger(ref.index)&&ref.index>=0&&ref.index<solidGeometry(item.type).vertices.length : constructionReferences(item).some(other=>sameReference(ref,other))))return null;
    const a=spatialPoint(item,ref),source=line.parallelTo;
    let basis;
    if(source?.kind==="line") basis=spatialLinePoints(item,(item.spatialLines??[]).find(other=>other.id===source.id),null,chain);
    else if(source?.kind==="edge" && item.type!=="viz-space" && isEdge(item,source.edge)) basis=source.edge.map(index=>solidGeometry(item.type).vertices[index]);
    else if(source?.kind==="axis" && item.type==="viz-space" && Number.isInteger(source.axis) && source.axis>=0 && source.axis<3) basis=[[0,0,0],[0,1,2].map(i=>i===source.axis?1:0)];
    if(!a || !basis)return null;
    const direction=basis[1].map((v,i)=>v-basis[0][i]),length=Math.hypot(...direction);
    if(length<1e-8)return null;
    points=[a,a.map((v,i)=>v+direction[i]/length)];
  }
  if(!projection)return points;
  // Legacy callers may pass projected vertices instead of a camera model.
  return projection.projectPoint ? points.map(projection.projectPoint) : line.kind!=="parallel" ? line.through.map(ref=>spatialPoint(item,ref,projection)) : null;
}

// Clip infinite lines and finite segments to the model window.
export function clippedSpatialLine(item,line,vertices,box) {
  const endpoints=spatialLinePoints(item,line,vertices);
  if(!endpoints)return null;
  const [a,b]=endpoints;
  if (!a || !b || Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6) return null;
  const delta=b.map((value,index)=>value-a[index]);
  let start=line.kind==="segment" ? 0 : -Infinity,end=line.kind==="segment" ? 1 : Infinity;
  for (let axis=0;axis<2;axis++) {
    const min=axis===0 ? box.x : box.y, max=min+(axis===0 ? box.width : box.height);
    if (Math.abs(delta[axis])<1e-9) { if (a[axis]<min || a[axis]>max) return null; continue; }
    const bounds=[(min-a[axis])/delta[axis],(max-a[axis])/delta[axis]].sort((x,y)=>x-y);
    start=Math.max(start,bounds[0]);end=Math.min(end,bounds[1]);
  }
  if (start>end) return null;
  return {a,b,start,end,ends:[start,end].map(t=>a.map((value,index)=>value+delta[index]*t))};
}

const dot3=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const sub3=(a,b)=>a.map((value,index)=>value-b[index]);
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// Hide only genuine 3D edge overlap, never an edge that merely lines up on screen.
export function edgePreservingLinePaths(item,line,segment) {
  const [a,b]=spatialLinePoints(item,line),u=sub3(b,a),length=dot3(u,u);
  const blocked=[];
  if(item.type!=="viz-space" && length>1e-12) for(const [i,j] of solidEdges(item.type)) {
    const vertices=solidGeometry(item.type).vertices,offsets=[sub3(vertices[i],a),sub3(vertices[j],a)];
    if(offsets.every(v=>Math.hypot(...cross3(v,u))<1e-7*Math.sqrt(length))) blocked.push(offsets.map(v=>dot3(v,u)/length).sort((x,y)=>x-y));
  }
  if(line.kind==="edge-extension") blocked.push([0,1]);
  const at=t=>segment.a.map((v,i)=>v+(segment.b[i]-v)*t);
  const path=(start,end)=>{
    let spans=[[start,end]];
    for(const [lo,hi] of blocked) spans=spans.flatMap(([s,e])=>hi<=s||lo>=e ? [[s,e]] : [[s,Math.min(e,lo)],[Math.max(s,hi),e]].filter(([p,q])=>q-p>1e-8));
    return spans.filter(([s,e])=>e-s>1e-8).map(([s,e])=>`M${at(s)} L${at(e)}`).join(" ");
  };
  return {dashed:path(segment.start,segment.end),solid:line.kind==="edge-extension" || line.kind==="parallel" ? "" : path(Math.max(0,segment.start),Math.min(1,segment.end))};
}

export function spatialIntersection(item,first,second) {
  const firstPoints=spatialLinePoints(item,first),secondPoints=spatialLinePoints(item,second);
  if(!firstPoints || !secondPoints)return null;
  const [p,p2]=firstPoints,[q,q2]=secondPoints;
  if (!p || !p2 || !q || !q2) return null;
  const u=sub3(p2,p),v=sub3(q2,q),w=sub3(q,p),normal=cross3(u,v),denom=dot3(normal,normal);
  if (denom<=1e-12*dot3(u,u)*dot3(v,v)) return null;
  const t=dot3(cross3(w,v),normal)/denom,s=dot3(cross3(w,u),normal)/denom;
  if ((first.kind==="segment" && (t< -1e-7 || t>1+1e-7)) || (second.kind==="segment" && (s< -1e-7 || s>1+1e-7))) return null;
  const a=p.map((value,index)=>value+t*u[index]),b=q.map((value,index)=>value+s*v[index]);
  if (Math.hypot(...sub3(a,b))>1e-7*Math.max(1,Math.hypot(...u),Math.hypot(...v))) return null;
  return a.map((value,index)=>(value+b[index])/2);
}
const isEdge=(item,edge)=>Array.isArray(edge) && edge.length===2 && edge.every(Number.isInteger) && solidEdges(item.type).some(pair=>pair.every((value,index)=>value===edge[index]) || pair.every((value,index)=>value===edge[1-index]));
export function resolveIntersection(item,point) {
  const sources=point.lines.map(id=>(item.spatialLines??[]).find(line=>line.id===id));
  if (sources.some(line=>!line)) return null;
  if (!point.edge) return sources.length===2 ? spatialIntersection(item,...sources) : null;
  if (sources.length!==1 || !isEdge(item,point.edge)) return null;
  const edgeLine={through:point.edge.map(index=>({kind:"vertex",index}))};
  const position=spatialIntersection(item,sources[0],edgeLine);
  if (!position) return null;
  const [a,b]=point.edge.map(index=>solidGeometry(item.type).vertices[index]),delta=sub3(b,a);
  const t=dot3(sub3(position,a),delta)/dot3(delta,delta);
  return t>=-1e-7 && t<=1+1e-7 ? position : null;
}
export function spatialIntersections(item) {
  const result=[],lines=item.spatialLines??[];
  const add=candidate=>{
    const position=resolveIntersection(item,candidate);
    if (position && position.every(Number.isFinite) && !result.some(point=>Math.hypot(...sub3(point.position,position))<1e-7)) result.push({...candidate,position});
  };
  for (let i=0;i<lines.length;i++) for (let j=i+1;j<lines.length;j++) add({lines:[lines[i].id,lines[j].id]});
  for (const line of lines) for (const edge of item.type==="viz-space" ? [] : solidEdges(item.type)) add({lines:[line.id],edge});
  return result;
}
// Rebuild dependent constructions in creation order; broken sources cannot leave orphan points.
export function sanitizeConstructions(item) {
  const candidates=Array.isArray(item.intersectionPoints) ? item.intersectionPoints.slice(0,200).filter(point=>point && typeof point.id==="string" && validPointLabel(point.label) && Array.isArray(point.lines) && ((point.lines.length===2 && point.lines[0]!==point.lines[1] && !point.edge) || (point.lines.length===1 && isEdge(item,point.edge))) && point.lines.every(id=>typeof id==="string")) : [];
  const resolved={...item,intersectionPoints:[],spatialLines:[]};
  for (let pass=0;pass<=candidates.length;pass++) {
    resolved.spatialLines=sanitizeSpatialLines({...resolved,spatialLines:item.spatialLines});
    let added=false;
    for (const candidate of candidates) {
      if (resolved.intersectionPoints.some(point=>point.id===candidate.id)) continue;
      const sources=candidate.lines.map(id=>resolved.spatialLines.find(line=>line.id===id));
      if (sources.some(line=>!line)) continue;
      const position=resolveIntersection(resolved,candidate);
      if (!position || !position.every(Number.isFinite)) continue;
      resolved.intersectionPoints.push({...candidate,position});added=true;
    }
    if (!added) break;
  }
  resolved.spatialPlanes=Array.isArray(item.spatialPlanes) ? item.spatialPlanes.slice(0,50).filter(plane=>plane && typeof plane.id==="string" && planeGeometry(resolved,plane.through)) : [];
  return resolved;
}

export function planeGeometry(item,through) {
  if (!Array.isArray(through) || through.length!==3 || !validSpatialPair(item,through.slice(0,2)) || !validSpatialPair(item,through.slice(1)) || !validSpatialPair(item,[through[0],through[2]])) return null;
  const [a,b,c]=through.map(reference=>spatialPoint(item,reference)),ab=sub3(b,a),ac=sub3(c,a),cross=cross3(ab,ac),length=Math.hypot(...cross);
  if (length<=1e-8*Math.hypot(...ab)*Math.hypot(...ac)) return null;
  const normal=cross.map(value=>value/length),u=ab.map(value=>value/Math.hypot(...ab)),v=cross3(normal,u);
  const vertices=solidGeometry(item.type).vertices,center=[0,1,2].map(axis=>vertices.reduce((sum,p)=>sum+p[axis],0)/vertices.length),offset=dot3(sub3(center,a),normal);
  const origin=center.map((value,index)=>value-offset*normal[index]);
  const radius=Math.max(...vertices.map(vertex=>Math.hypot(...sub3(vertex,center))),...(item.freePoints??[]).map(point=>Math.hypot(...sub3(point.position,center))))*1.45;
  const patch=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>origin.map((value,index)=>value+radius*(u[index]*x+v[index]*y)));
  const section=[];
  const add=point=>{if(!section.some(p=>Math.hypot(...sub3(point,p))<1e-7))section.push(point);};
  for (const edge of solidEdges(item.type)) {
    const [p,q]=edge.map(index=>vertices[index]),dp=dot3(sub3(p,a),normal),dq=dot3(sub3(q,a),normal);
    if (Math.abs(dp)<1e-7) add(p);
    if (Math.abs(dq)<1e-7) add(q);
    if (dp*dq<0) add(p.map((value,index)=>value+(q[index]-value)*dp/(dp-dq)));
  }
  const centroid=[0,1,2].map(axis=>section.reduce((sum,p)=>sum+p[axis],0)/(section.length||1));
  section.sort((p,q)=>Math.atan2(dot3(sub3(p,centroid),v),dot3(sub3(p,centroid),u))-Math.atan2(dot3(sub3(q,centroid),v),dot3(sub3(q,centroid),u)));
  return {patch,section,normal,origin:a};
}
export function clipPolygon(points,box) {
  let result=points;
  for (const [axis,bound,sign] of [[0,box.x,1],[0,box.x+box.width,-1],[1,box.y,1],[1,box.y+box.height,-1]]) {
    const input=result;result=[];
    for(let i=0;i<input.length;i++) {
      const a=input[i],b=input[(i+1)%input.length],insideA=(a[axis]-bound)*sign>=0,insideB=(b[axis]-bound)*sign>=0;
      if(insideA)result.push(a);
      if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);result.push(a.map((value,index)=>value+(b[index]-value)*t));}
    }
  }
  return result;
}

export function withoutConstruction(item,selection) {
  const fields={free:"freePoints",point:"edgePoints",intersection:"intersectionPoints",line:"spatialLines",plane:"spatialPlanes"};
  const field=fields[selection?.kind];
  if (!field || !(item[field]??[]).some(object=>object.id===selection.id)) return item;
  const next={...item,[field]:item[field].filter(object=>object.id!==selection.id)};
  return selection.kind==="plane" ? next : sanitizeConstructions(next);
}

export const workingPlaneAxes = plane => plane==="xz" ? [0,2] : plane==="yz" ? [1,2] : [0,1];
export function pointOnWorkingPlane(model,screen,plane) {
  const axes=workingPlaneAxes(plane),origin=model.projectPoint([0,0,0]),basis=axes.map(axis=>model.projectPoint([0,1,2].map(i=>i===axis?1:0)).map((value,index)=>value-origin[index]));
  const det=basis[0][0]*basis[1][1]-basis[1][0]*basis[0][1];
  if(Math.abs(det)<1e-7)return null;
  const [x,y]=screen.map((value,index)=>value-origin[index]);
  const values=[(x*basis[1][1]-y*basis[1][0])/det,(basis[0][0]*y-basis[0][1]*x)/det];
  if(values.some(value=>Math.abs(value)>(model.extent??3)+.05))return null;
  const point=[0,0,0];axes.forEach((axis,index)=>{point[axis]=Math.round(values[index]*4)/4;});return point;
}

export function nearestCoordinateAxis(model,position) {
  let nearest=null;
  for(let axis=0;axis<3;axis++) {
    const origin=model.projectPoint([0,0,0]),unit=model.projectPoint([0,1,2].map(i=>i===axis?1:0));
    const delta=unit.map((v,i)=>v-origin[i]),length=delta[0]**2+delta[1]**2;
    if(length<1e-8)continue;
    const coordinate=Math.max(-model.extent,Math.min(model.extent,delta.reduce((sum,v,i)=>sum+v*(position[i]-origin[i]),0)/length));
    const distance=Math.hypot(...position.map((v,i)=>v-origin[i]-coordinate*delta[i]));
    if(!nearest || distance<nearest.distance)nearest={axis,distance,position:[0,1,2].map(i=>i===axis?Math.round(coordinate*4)/4:0)};
  }
  return nearest;
}
