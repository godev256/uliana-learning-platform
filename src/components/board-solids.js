const models = {
  cube: { vertices: [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]], faces: [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]] },
  tetrahedron: { vertices: [[0,1,0],[-1,-.633,-.577],[1,-.633,-.577],[0,-.633,1.155]], faces: [[1,2,3],[0,2,1],[0,3,2],[0,1,3]] },
  prism: { vertices: [[-1,-1,-.6],[1,-1,-.6],[0,-1,1.1],[-1,1,-.6],[1,1,-.6],[0,1,1.1]], faces: [[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]] },
  pyramid: { vertices: [[0,1.35,0],[-1,-.75,-1],[1,-.75,-1],[1,-.75,1],[-1,-.75,1]], faces: [[1,4,3,2],[0,2,1],[0,3,2],[0,4,3],[0,1,4]] },
};
models.cuboid = { ...models.cube, vertices: models.cube.vertices.map(([x,y,z]) => [x*1.4,y*.8,z*.7]) };
models.space = {...models.cube,vertices:models.cube.vertices.map(point=>point.map(value=>value*3))};
export const validPointLabel = label => typeof label==="string" && /^[\p{L}\p{N}_'′″]{1,8}$/u.test(label);
export const pointLabelKey = label => label.normalize("NFKC").toUpperCase();
export function sanitizeFreePoints(points) {
  return Array.isArray(points) ? points.slice(0,200).filter(point=>point && typeof point.id==="string" && validPointLabel(point.label) && Array.isArray(point.position) && point.position.length===3 && point.position.every(value=>Number.isFinite(value)&&Math.abs(value)<=100)) : [];
}
export const isVisualization = type => type.startsWith("viz-");
export const solidType = type => isVisualization(type) ? type.slice(4) : type;
export const isSolid = type => Object.hasOwn(models, solidType(type));
export const vertexNames = {
  space: [],
  cube: ["A","B","B₁","A₁","D","C","C₁","D₁"],
  cuboid: ["A","B","B₁","A₁","D","C","C₁","D₁"],
  tetrahedron: ["D","A","B","C"],
  prism: ["A","B","C","A₁","B₁","C₁"],
  pyramid: ["E","A","B","C","D"],
};
export const vertexOrder = type => vertexNames[solidType(type)].map((_,index)=>index).sort((a,b)=>Number(vertexNames[solidType(type)][a].endsWith("₁"))-Number(vertexNames[solidType(type)][b].endsWith("₁")) || vertexNames[solidType(type)][a].charCodeAt(0)-vertexNames[solidType(type)][b].charCodeAt(0));
export const solidGeometry = type => models[solidType(type)];
export function solidEdges(type) {
  const edges=new Map();
  for(const face of solidGeometry(type).faces) for(let i=0;i<face.length;i++) {
    const pair=[face[i],face[(i+1)%face.length]].sort((a,b)=>a-b);
    edges.set(pair.join(","),pair);
  }
  return [...edges.values()];
}
export function sanitizeEdgePoints(type, points) {
  if (!Array.isArray(points)) return [];
  const model = solidGeometry(type);
  return points.slice(0,200).filter(p => p && typeof p.id === "string" && validPointLabel(p.label) && Number.isFinite(p.t) && p.t >= 0 && p.t <= 1 && Array.isArray(p.edge) && p.edge.length === 2 && p.edge.every(Number.isInteger) && p.edge[0] !== p.edge[1] && model.faces.some(face => face.some((v,i) => v === p.edge[0] && (face[(i+1)%face.length] === p.edge[1] || face[(i+face.length-1)%face.length] === p.edge[1]))));
}
const dot = (a,b) => a.reduce((value,x,i) => value + x*b[i], 0);
const subtract = (a,b) => a.map((x,i) => x-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

export function projectSolid(type, rotation, box, stable = false, extent = 3) {
  const source=models[solidType(type)];
  const model=solidType(type)==="space" ? {...source,vertices:source.vertices.map(point=>point.map(value=>value*extent/3))} : source;
  const center = [0,1,2].map(axis => model.vertices.reduce((sum,p) => sum+p[axis],0)/model.vertices.length);
  const [pitch,yaw,roll] = (rotation ?? [0,0,0]).map(value => value*Math.PI/180);
  const transform = vertex => {
    let [x,y,z] = subtract(vertex,center);
    if (solidType(type)==="space") [y,z]=[z,-y];
    [x,z] = [x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw)];
    [y,z] = [y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];
    [x,y] = [x*Math.cos(roll)-y*Math.sin(roll),x*Math.sin(roll)+y*Math.cos(roll)];
    if (stable) {
      // An upright orthographic camera preserves the solid's proportions without shear.
      const azimuth = Math.PI/6, elevation = Math.PI/8;
      [x,z] = [x*Math.cos(azimuth)+z*Math.sin(azimuth),-x*Math.sin(azimuth)+z*Math.cos(azimuth)];
      [y,z] = [y*Math.cos(elevation)-z*Math.sin(elevation),y*Math.sin(elevation)+z*Math.cos(elevation)];
    }
    return [x,y,z];
  };
  const vertices = model.vertices.map(transform);
  // Oblique projection keeps the resting base horizontal in the default view.
  const view = stable ? [0,0,1] : [-.4,.2,1];
  const points = vertices.map(([x,y,z]) => stable ? [x,-y] : [x+.4*z,-y+.2*z]);
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
  const radius = (solidType(type)==="space" ? extent : Math.max(...vertices.map(p => Math.hypot(...p)))) * 1.1;
  const scale = stable ? Math.min(box.width,box.height)/(radius*2) : Math.min(box.width/(maxX-minX),box.height/(maxY-minY));
  const projected = points.map(([x,y]) => [box.x+(box.width-(maxX-minX)*scale)/2+(x-minX)*scale,box.y+(box.height-(maxY-minY)*scale)/2+(y-minY)*scale]);
  const projectPoint = vertex => {
    const [x,y,z]=transform(vertex),[sx,sy]=stable ? [x,-y] : [x+.4*z,-y+.2*z];
    return [box.x+(box.width-(maxX-minX)*scale)/2+(sx-minX)*scale,box.y+(box.height-(maxY-minY)*scale)/2+(sy-minY)*scale];
  };
  const edges = new Map();
  const faces = [];
  for (const face of model.faces) {
    const a = vertices[face[0]], b = vertices[face[1]], c = vertices[face[2]];
    let normal = cross(subtract(b,a),subtract(c,a));
    const faceCenter = [0,1,2].map(axis => face.reduce((sum,index) => sum+vertices[index][axis],0)/face.length);
    if (dot(normal,faceCenter)<0) normal = normal.map(value => -value);
    const visible = dot(normal,view) > 1e-8;
    if (visible) faces.push({ points: face.map(index => projected[index].join(",")).join(" "), depth: dot(faceCenter,view), light: dot(normal,[-.4,.8,1])/Math.hypot(...normal)/Math.hypot(-.4,.8,1) });
    for (let i=0;i<face.length;i++) {
      const pair = [face[i],face[(i+1)%face.length]].sort((x,y)=>x-y);
      const key = pair.join("-");
      edges.set(key,{pair,visible:visible || edges.get(key)?.visible || false});
    }
  }
  const path = visible => [...edges.values()].filter(edge=>edge.visible===visible).map(({pair:[a,b]})=>`M${projected[a]} L${projected[b]}`).join(" ");
  return { extent, projectPoint, vertices:projected, edges:[...edges.values()], visible:path(true), hidden:path(false), faces: faces.sort((a,b)=>a.depth-b.depth) };
}
