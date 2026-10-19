import {useLayoutEffect,useRef,useState} from 'react';
import BoardIcon from './board-icons.jsx';
import {createPortal} from 'react-dom';

export default function DrawingToolSettings({anchor,highlighter,colors,color,size,onChange,onClose}){
 const panel=useRef(null),[position,setPosition]=useState(null);
 useLayoutEffect(()=>{
  const place=()=>{
   const button=anchor?.getBoundingClientRect(),box=panel.current?.getBoundingClientRect();if(!button||!box)return;
   // On the side toolbar, open beside the button; on desktop, open just below it.
   const side=window.matchMedia('(max-width:1024px), (any-pointer:coarse)').matches;
   const left=side?button.right+8:button.left,top=side?button.top:button.bottom+8;
   setPosition({left:Math.max(8,Math.min(left,innerWidth-box.width-8)),top:Math.max(8,Math.min(top,innerHeight-box.height-8))});
  };
  place();const observer=new ResizeObserver(place);if(anchor)observer.observe(anchor);if(panel.current)observer.observe(panel.current);
  window.addEventListener('resize',place);document.addEventListener('scroll',place,true);
  const outside=event=>{if(!panel.current?.contains(event.target)&&!anchor?.contains(event.target))onClose(false);};
  const escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose(true);}};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);
  panel.current?.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
  return()=>{observer.disconnect();window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);};
 },[anchor,onClose]);
 const title=highlighter?'Настройки выделителя':'Настройки ручки';
 return createPortal(<section ref={panel} id="board-tool-settings" className="board-drawing-settings" role="dialog" aria-modal="false" aria-label={title} style={{left:position?.left??0,top:position?.top??0,visibility:position?'visible':'hidden'}}>
  <header><span>{title}</span><button type="button" aria-label="Закрыть настройки" onClick={()=>onClose(true)}><BoardIcon name="close"/></button></header>
  <div className="board-colors" role="group" aria-label={highlighter?'Цвет выделителя':'Цвет'}>{colors.map(([value,label])=><button key={value} type="button" title={label} style={{'--swatch':value}} aria-label={label} aria-pressed={color===value} onClick={()=>onChange('color',value)}/>)}</div>
  <label className="board-size">Толщина <input type="range" aria-label={highlighter?'Толщина выделителя':'Толщина ручки'} min={highlighter?16:2} max={highlighter?72:12} value={size} onChange={event=>onChange('size',Number(event.target.value))}/><output>{size}</output></label>
  <svg className="board-stroke-preview" viewBox="0 0 230 54" aria-label="Образец штриха"><path d="M22 30 Q65 10 112 28 T208 25" fill="none" stroke={color} strokeWidth={highlighter?size*.5:size} strokeOpacity={highlighter ? 0.3 : 1} strokeLinecap="round"/></svg>
 </section>,document.body);
}
