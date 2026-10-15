import { workingPlaneAxes } from "./board-space.js";

export function CoordinateSpace({model,workingPlane,fontSize,clipBox,clipId}) {
  const axes=workingPlaneAxes(workingPlane),range=model.extent??3;
  const point=(u,v)=>{const p=[0,0,0];p[axes[0]]=u;p[axes[1]]=v;return model.projectPoint(p);};
  const corners=[[-range,-range],[range,-range],[range,range],[-range,range]].map(([u,v])=>point(u,v));
  const step=Math.max(1,Math.ceil(range/6)),ticks=[];for(let value=-range;value<=range;value+=step)ticks.push(value);
  const origin=model.projectPoint([0,0,0]);
  return <g pointerEvents="none" data-coordinate-space="true" clipPath={`url(#${clipId})`}>
    <defs><clipPath id={clipId}><rect x={clipBox.x} y={clipBox.y} width={clipBox.width} height={clipBox.height}/></clipPath></defs>
    <polygon points={corners.map(p=>p.join(",")).join(" ")} fill="#f1f6f5" fillOpacity=".7" stroke="#d3dfdc" strokeWidth="2" />
    {ticks.map(value=><g key={value} stroke="#dce5e1" strokeWidth="1.5">
      <path d={`M${point(value,-range)} L${point(value,range)}`} fill="none"/><path d={`M${point(-range,value)} L${point(range,value)}`} fill="none"/>
    </g>)}
    {["X","Y","Z"].map((label,axis)=>{
      const endpoint=value=>model.projectPoint([0,1,2].map(index=>index===axis?value:0));
      const start=endpoint(-range),end=endpoint(range),dx=end[0]-origin[0],dy=end[1]-origin[1],length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,arrow=fontSize*.45;
      return <g key={axis} data-coordinate-axis={label} stroke="#6d7e78" strokeWidth="3" fill="none">
        <path d={`M${start} L${origin}`} strokeDasharray="10 8" strokeOpacity=".5"/><path d={`M${origin} L${end}`}/>
        <path d={`M${end[0]-ux*arrow-uy*arrow*.4},${end[1]-uy*arrow+ux*arrow*.4} L${end} L${end[0]-ux*arrow+uy*arrow*.4},${end[1]-uy*arrow-ux*arrow*.4}`}/>
        <text x={end[0]+ux*fontSize*.7} y={end[1]+uy*fontSize*.7} dominantBaseline="central" textAnchor="middle" fontSize={fontSize*.85} fill="#39574b" stroke="white" strokeWidth="4" paintOrder="stroke">{label}</text>
        {ticks.filter(value=>value!==0 && Math.abs(value)<range).map(value=>{const [x,y]=endpoint(value);return <text key={value} x={x-uy*fontSize*.3} y={y+ux*fontSize*.3} fill="#7d8e86" stroke="white" strokeWidth="3" paintOrder="stroke" fontSize={fontSize*.4} textAnchor="middle">{value}</text>;})}
      </g>;
    })}
    <text x={origin[0]-fontSize*.3} y={origin[1]+fontSize*.5} fill="#6d7e78" fontSize={fontSize*.6}>0</text>
  </g>;
}
