// Only new strokes opt in, so existing notebooks keep their original appearance.
export function stabilizedStrokePoints(points, radius) {
  if (points.length < 3 || !Number.isFinite(radius) || radius <= 0) return points;
  const distances=[0];
  for(let i=1;i<points.length;i++) distances.push(distances[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  return points.map((point,index)=>{
    if(!index || index===points.length-1)return point;
    let left=index,right=index;
    // Bound the work for dense stylus samples, and use distance rather than
    // sample count so a slow oval receives the same gentle stabilization.
    while(left>0 && index-left<16 && distances[index]-distances[left]<radius)left--;
    while(right<points.length-1 && right-index<16 && distances[right]-distances[index]<radius)right++;
    const a=points[left],b=points[right],ax=point[0]-a[0],ay=point[1]-a[1],bx=b[0]-point[0],by=b[1]-point[1];
    const al=Math.hypot(ax,ay),bl=Math.hypot(bx,by);
    // Real corners have sustained directions on both sides; tiny jitter does not.
    if(al>=radius*.75 && bl>=radius*.75 && (ax*bx+ay*by)/(al*bl)<.5)return point;
    let weight=1,x=point[0],y=point[1];
    for(let i=left;i<=right;i++){
      if(i===index)continue;
      const w=Math.max(0,1-Math.abs(distances[i]-distances[index])/radius)**2;
      weight+=w;x+=points[i][0]*w;y+=points[i][1]*w;
    }
    return [x/weight,y/weight];
  });
}

export function strokeDrawingPoints(points, smoothing, distance) {
  return smoothing===2 ? stabilizedStrokePoints(points,distance) : points;
}

export function strokePath(points, smoothing, distance) {
  points=strokeDrawingPoints(points,smoothing,distance);
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0]} l0.01,0`;
  if (smoothing !== 1 && smoothing !== 2) return points.map((p, i) => `${i ? "L" : "M"}${p}`).join(" ");
  const path = [`M${points[0]}`];
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1], current = points[i], next = points[i + 1];
    const ax = current[0] - previous[0], ay = current[1] - previous[1];
    const bx = next[0] - current[0], by = next[1] - current[1];
    const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
    const midpoint = [(current[0] + next[0]) / 2, (current[1] + next[1]) / 2];
    // Preserve intentional corners (e.g. roots and angles). Quadratics stay
    // inside the sampled bounds, without spline overshoot or invented loops.
    if (length && (ax * bx + ay * by) / length < .5) path.push(`L${current} L${midpoint}`);
    else path.push(`Q${current} ${midpoint}`);
  }
  path.push(`L${points.at(-1)}`);
  return path.join(" ");
}

export function appendStrokePoints(points, samples) {
  let result = points;
  for (const sample of samples) {
    const last = result.at(-1);
    if (last && last[0] === sample[0] && last[1] === sample[1]) continue;
    if (result === points) result = points.slice();
    result.push(sample);
  }
  return result;
}
