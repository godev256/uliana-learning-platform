import {useRef,useState} from 'react';
import {useAssetUrl} from './board-attachments.jsx';
import {shapeBounds} from './board-shapes.jsx';

export default function ImageCrop({item,onApply,onClose}){
 const url=useAssetUrl(item.assetId,item.src),box=shapeBounds(item),existing=item.crop??{x:0,y:0,width:1,height:1};
 const[area,setArea]=useState({x:0,y:0,width:1,height:1});
 const gesture=useRef(null);
 function position(event){const bounds=event.currentTarget.getBoundingClientRect();return [Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)),Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height))];}
 function start(event){
  if(event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
  const corner=event.target.closest('[data-crop-corner]')?.dataset.cropCorner;
  const anchor=corner===undefined?position(event):[Number(corner)===0||Number(corner)===3?area.x+area.width:area.x,Number(corner)<2?area.y+area.height:area.y];
  gesture.current={pointerId:event.pointerId,anchor,before:area};if(corner===undefined)setArea({x:anchor[0],y:anchor[1],width:0,height:0});
 }
 function move(event){const saved=gesture.current;if(!saved||saved.pointerId!==event.pointerId)return;const[x,y]=saved.anchor,[endX,endY]=position(event);setArea({x:Math.min(x,endX),y:Math.min(y,endY),width:Math.abs(endX-x),height:Math.abs(endY-y)});}
 function finish(event){if(gesture.current?.pointerId!==event.pointerId)return;if(event.type==='pointercancel')setArea(gesture.current.before);gesture.current=null;}
 return <div className="board-dialog-backdrop board-crop-backdrop"><section className="board-dialog board-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-image-title">
  <h2 id="crop-image-title">Обрезать изображение</h2><p>Выделите область, которую хотите оставить, или потяните за уголки рамки.</p>
  <div className="board-crop-stage" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} style={{'--crop-ratio':box.width/Math.max(1,box.height)}}>
   <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="Область обрезки изображения">
    <svg width="1" height="1" viewBox={`${existing.x} ${existing.y} ${existing.width} ${existing.height}`} preserveAspectRatio="none"><image href={url} width="1" height="1" preserveAspectRatio="none"/></svg>
    <path d={`M0 0H1V1H0Z M${area.x} ${area.y}v${area.height}h${area.width}v-${area.height}Z`} fill="#212123" fillOpacity=".55" fillRule="evenodd" pointerEvents="none"/>
    <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="none" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>

   </svg>
   {[[area.x,area.y],[area.x+area.width,area.y],[area.x+area.width,area.y+area.height],[area.x,area.y+area.height]].map(([x,y],index)=><button type="button" key={index} data-crop-corner={index} aria-label={`Угол рамки ${index+1}`} style={{left:`${x*100}%`,top:`${y*100}%`}}/>)}
  </div>
  <div className="board-crop-actions"><button type="button" className="board-action" autoFocus onClick={onClose}>Отмена</button><button type="button" className="board-action" onClick={()=>setArea({x:0,y:0,width:1,height:1})}>Сбросить рамку</button><button type="button" className="board-action board-pdf-button" disabled={!url||area.width<.01||area.height<.01} onClick={()=>onApply(area)}>Применить обрезку</button></div>
 </section></div>;
}
