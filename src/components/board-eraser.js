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
export function eraserPolyline(item, tolerance=.5) {
  const points=strokeDrawingPoints(item.points,item.smoothing,item.smoothingDistance);
  if (![1,2].includes(item.smoothing) || points.length<3) return points;
  const result=[points[0]];
  const curve=(a,c,b,depth=0)=>{
    if (depth>=12 || distanceSquared(c,a,b)<=tolerance*tolerance) {result.push(b);return;}
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

function clippedRange(start, delta, min, max, interval=[0,1]) {
  if(Math.abs(delta)<1e-12)return start>=min&&start<=max ? interval : null;
  const a=(min-start)/delta,b=(max-start)/delta;
  const low=Math.max(interval[0],Math.min(a,b)),high=Math.min(interval[1],Math.max(a,b));
  return high>=low ? [low,high] : null;
}
function circleRange(a,v,center,radius) {
  const x=a[0]-center[0],y=a[1]-center[1],aa=v[0]*v[0]+v[1]*v[1];
  if(!aa)return x*x+y*y<=radius*radius ? [0,1] : null;
  const bb=2*(x*v[0]+y*v[1]),cc=x*x+y*y-radius*radius,disc=bb*bb-4*aa*cc;
  if(disc<0)return null;
  const root=Math.sqrt(disc),low=Math.max(0,(-bb-root)/(2*aa)),high=Math.min(1,(-bb+root)/(2*aa));
  return high>=low ? [low,high] : null;
}
function capsuleRanges(a,b,c,d,radius) {
  const v=[b[0]-a[0],b[1]-a[1]],dx=d[0]-c[0],dy=d[1]-c[1],length=Math.hypot(dx,dy);
  const intervals=[circleRange(a,v,c,radius)];
  if(length){
    intervals.push(circleRange(a,v,d,radius));
    const ux=dx/length,uy=dy/length,x=a[0]-c[0],y=a[1]-c[1];
    const along=clippedRange(x*ux+y*uy,v[0]*ux+v[1]*uy,0,length);
    if(along)intervals.push(clippedRange(-x*uy+y*ux,-v[0]*uy+v[1]*ux,-radius,radius,along));
  }
  return intervals.filter(interval=>interval&&interval[1]-interval[0]>1e-9);
}

// Clip against the whole swept disk analytically, so even a two-point line
// can be cut in its middle without deleting the writing on either side.
export function cutInkPolyline(points,sweep,radius) {
  if(points.length===1)return eraserHits(points,sweep,radius) ? [] : null;
  const fragments=[];let current=[],changed=false;
  const flush=()=>{if(current.length>1)fragments.push(current);current=[];};
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],intervals=[];
    for(let j=0;j<sweep.length;j++)intervals.push(...capsuleRanges(a,b,sweep[Math.max(0,j-1)],sweep[j],radius));
    intervals.sort((x,y)=>x[0]-y[0]);
    const cuts=[];
    for(const range of intervals){
      const last=cuts.at(-1);
      if(last&&range[0]<=last[1]+1e-9)last[1]=Math.max(last[1],range[1]);else cuts.push([...range]);
    }
    const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    const append=(from,to)=>{
      if(to-from<=1e-9)return;
      const start=at(from),end=at(to),last=current.at(-1);
      if(!last||Math.hypot(last[0]-start[0],last[1]-start[1])>1e-7){flush();current.push(start);}
      current.push(end);
    };
    let from=0;
    for(const [low,high] of cuts){changed=true;append(from,low);flush();from=high;}
    append(from,1);
  }
  flush();
  return changed ? fragments : null;
}

export function eraserCursor(size) {
  const center=size/2+2;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size+4}" height="${size+4}"><circle cx="${center}" cy="${center}" r="${size/2}" fill="white" fill-opacity=".5" stroke="#2f493f" stroke-width="1.4"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
}
