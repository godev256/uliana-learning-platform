import {useRef,useState} from 'react';
import {moveCrop,resizeCrop} from './board-crop-geometry.js';
import {shapeBounds} from './board-shapes.jsx';

// The source image remains on the sheet; only the editing frame is drawn above it.
export default function ImageCrop({item,onApply,onClose,scale=1,pageWidth,pageHeight}){
 const box=shapeBounds(item),[area,setArea]=useState({x:0,y:0,width:1,height:1}),gesture=useRef(null);
 function position(event){const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(event.currentTarget.getScreenCTM().inverse());return [Math.max(0,Math.min(1,point.x)),Math.max(0,Math.min(1,point.y))];}
 function start(event){
  if(event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  const handle=event.target.closest('[data-crop-handle]')?.dataset.cropHandle;
  gesture.current={pointerId:event.pointerId,start:position(event),before:area,handle:handle===undefined?null:Number(handle)};
 }
 function move(event){
  const saved=gesture.current;if(!saved||saved.pointerId!==event.pointerId)return;event.stopPropagation();
  const current=position(event),delta=current.map((value,index)=>value-saved.start[index]);
  setArea(saved.handle===null?moveCrop(saved.before,delta):resizeCrop(saved.before,saved.handle,delta));
 }
 function finish(event){event.stopPropagation();if(gesture.current?.pointerId!==event.pointerId)return;if(event.type==='pointercancel')setArea(gesture.current.before);gesture.current=null;}
 const toolbarWidth=Math.min(pageWidth-16*scale,370*scale),compact=toolbarWidth/scale<330,toolbarHeight=(compact?94:52)*scale;
 const toolbarX=Math.max(8*scale,Math.min(pageWidth-toolbarWidth-8*scale,box.x+(box.width-toolbarWidth)/2));
 const toolbarY=box.y+box.height+toolbarHeight+12*scale<pageHeight?box.y+box.height+8*scale:Math.max(8*scale,box.y-toolbarHeight-8*scale);
 const handleWidth=Math.min(.22,32*scale/box.width),handleHeight=Math.min(.22,32*scale/box.height);
 const markers=[[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]];
 return <g className="board-inline-crop" data-selection-controls="true" role="group" aria-label="Обрезать изображение на листе" onPointerDown={event=>event.stopPropagation()}>
  <svg className="board-crop-stage" x={box.x} y={box.y} width={box.width} height={box.height} viewBox="0 0 1 1" preserveAspectRatio="none" overflow="visible" aria-label="Область обрезки изображения" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
   <rect width="1" height="1" fill="transparent"/>
   <rect data-crop-move="true" x={area.x} y={area.y} width={area.width} height={area.height} fill="transparent" style={{cursor:"move"}}/>
   <path d={`M0 0H1V1H0Z M${area.x} ${area.y}v${area.height}h${area.width}v-${area.height}Z`} fill="#212123" fillOpacity=".48" fillRule="evenodd" pointerEvents="none"/>
   <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="none" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
   {[1/3,2/3].map(t=><path key={t} d={`M${area.x+area.width*t} ${area.y}v${area.height} M${area.x} ${area.y+area.height*t}h${area.width}`} stroke="white" strokeOpacity=".5" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>)}
   {[[1,[area.x,area.y],[area.x+area.width,area.y]],[3,[area.x+area.width,area.y],[area.x+area.width,area.y+area.height]],[5,[area.x,area.y+area.height],[area.x+area.width,area.y+area.height]],[7,[area.x,area.y],[area.x,area.y+area.height]]].map(([handle,a,b])=><path key={handle} data-crop-handle={handle} d={`M${a} L${b}`} fill="none" stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" pointerEvents="stroke" style={{cursor:handle===1||handle===5?"ns-resize":"ew-resize"}}/>)}
   {markers.map(([u,v],index)=>{
    const x=area.x+u*area.width,y=area.y+v*area.height,corner=index%2===0;
    // Keep corner targets reachable even when the image is small on a phone.
    if(!corner && (index===1||index===5?area.width*box.width/scale:area.height*box.height/scale)<70)return null;
    const cursor=["nwse-resize","ns-resize","nesw-resize","ew-resize","nwse-resize","ns-resize","nesw-resize","ew-resize"][index];
    return <g key={index} data-crop-handle={index} style={{cursor}}>
     <rect x={x-handleWidth/2} y={y-handleHeight/2} width={handleWidth} height={handleHeight} fill="transparent"/>
     <rect x={x-(corner?5: index===1||index===5?10:3)*scale/box.width} y={y-(corner?5: index===3||index===7?10:3)*scale/box.height} width={(corner?10:index===1||index===5?20:6)*scale/box.width} height={(corner?10:index===3||index===7?20:6)*scale/box.height} rx={scale/Math.max(box.width,box.height)} fill="white" stroke="#2f493f" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    </g>;
   })}
  </svg>
  <g className="board-inline-crop-actions" transform={`translate(${toolbarX} ${toolbarY})`}>
   <rect width={toolbarWidth} height={toolbarHeight} rx={10*scale} fill="#fbfaf6" stroke="#cdd8ce" strokeWidth={scale}/>
   {[
    {label:"Отмена",action:onClose},
    {label:"Сбросить рамку",action:()=>setArea({x:0,y:0,width:1,height:1})},
    {label:"Применить обрезку",action:()=>onApply(area),primary:true,disabled:area.width<.01||area.height<.01}
   ].map((button,index)=>{
    const gap=6*scale,inner=toolbarWidth-2*gap;
    const widths=compact?[(inner-gap)*.4,(inner-gap)*.6,inner]:[(inner-2*gap)*.2,(inner-2*gap)*.36,(inner-2*gap)*.44];
    const bx=gap+(compact&&index===2?0:widths.slice(0,index).reduce((sum,width)=>sum+width+gap,0)),by=gap+(compact&&index===2?42*scale:0);
    return <g key={button.label} role="button" tabIndex={0} aria-label={button.label} aria-disabled={button.disabled||undefined} className="board-inline-crop-action" transform={`translate(${bx} ${by})`} onClick={()=>{if(!button.disabled)button.action();}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();if(!button.disabled)button.action();}}}>
     <rect width={widths[index]} height={36*scale} rx={7*scale} fill={button.primary?"#2f493f":"#fbfaf6"} opacity={button.disabled ? .5 : 1}/>
     <text x={widths[index]/2} y={18*scale} dominantBaseline="central" textAnchor="middle" fill={button.primary?"white":"#2f493f"} fontFamily="Golos Text, Arial, sans-serif" fontSize={11*scale} pointerEvents="none">{button.label}</text>
    </g>;
   })}
  </g>
 </g>;
}
