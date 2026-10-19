import { strokeDrawingPoints } from "./board-strokes.js";

const distanceSquared = (point, a, b) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length ? Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)) : 0;
  return (point[0]-a[0]-t*dx)**2+(point[1]-a[1]-t*dy)**2;
};
const cross = (a,b,p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);

function segmentsNear(a,b,c,d,radius) {
  if (Math.max(a[0],b[0])+radius<Math.min(c[0],d[0]) || Math.min(a[0],b[0])-radius>Math.max(c[0],d[0]) ||
      Math.max(a[1],b[1])+radius<Math.min(c[1],d[1]) || Math.min(a[1],b[1])-radius>Math.max(c[1],d[1])) return false;
  // Intersecting segments have distance zero, even when neither endpoint is near.
  if (Math.max(a[0],b[0])>=Math.min(c[0],d[0]) && Math.min(a[0],b[0])<=Math.max(c[0],d[0]) &&
      Math.max(a[1],b[1])>=Math.min(c[1],d[1]) && Math.min(a[1],b[1])<=Math.max(c[1],d[1]) &&
      cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0) return true;
  const limit=radius*radius;
  return distanceSquared(a,c,d)<=limit || distanceSquared(b,c,d)<=limit || distanceSquared(c,a,b)<=limit || distanceSquared(d,a,b)<=limit;
}

// Flatten the same rounded path that is displayed, rather than the raw samples.
// Half a board unit of curve error stays smaller than the eraser at every zoom.
export function eraserPolyline(item) {
  const points=strokeDrawingPoints(item.points,item.smoothing,item.smoothingDistance);
  if (![1,2].includes(item.smoothing) || points.length<3) return points;
  const result=[points[0]];
  const curve=(a,c,b,depth=0)=>{
    if (depth>=12 || distanceSquared(c,a,b)<=.25) {result.push(b);return;}
    const ac=[(a[0]+c[0])/2,(a[1]+c[1])/2],cb=[(c[0]+b[0])/2,(c[1]+b[1])/2];
    const middle=[(ac[0]+cb[0])/2,(ac[1]+cb[1])/2];
    curve(a,ac,middle,depth+1);curve(middle,cb,b,depth+1);
  };
  for(let i=1;i<points.length-1;i++){
    const previous=points[i-1],current=points[i],next=points[i+1];
    const ax=current[0]-previous[0],ay=current[1]-previous[1],bx=next[0]-current[0],by=next[1]-current[1];
    const length=Math.hypot(ax,ay)*Math.hypot(bx,by),midpoint=[(current[0]+next[0])/2,(current[1]+next[1])/2];
    if(length&&(ax*bx+ay*by)/length<.5)result.push(current,midpoint);
    else curve(result.at(-1),current,midpoint);
  }
  result.push(points.at(-1));
  return result;
}

export function eraserHits(points, sweep, radius) {
  for(let i=0;i<sweep.length;i++){
    const a=sweep[Math.max(0,i-1)],b=sweep[i];
    for(let j=0;j<points.length;j++){
      if(segmentsNear(a,b,points[Math.max(0,j-1)],points[j],radius))return true;
    }
  }
  return false;
}
