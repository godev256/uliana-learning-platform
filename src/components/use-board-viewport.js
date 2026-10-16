import {useLayoutEffect,useRef,useState} from 'react';
export const BOARD_TOUCH_QUERY='(max-width: 1024px), (any-pointer: coarse)';
export const BOARD_DEFAULT_ZOOM=.75;
export const BOARD_MIN_ZOOM=.5;
const clampZoom=value=>Math.max(BOARD_MIN_ZOOM,Math.min(4,value));

export function useBoardViewport(cancelDrawing){
 const viewportRef=useRef(null),contentRef=useRef(null),cancelRef=useRef(cancelDrawing);
 cancelRef.current=cancelDrawing;
 const[zoom,setZoom]=useState(BOARD_DEFAULT_ZOOM),[viewportWidth,setViewportWidth]=useState(0);
 const zoomRef=useRef(BOARD_DEFAULT_ZOOM),renderedZoom=useRef(BOARD_DEFAULT_ZOOM),anchor=useRef(null),frame=useRef(null),touches=useRef(new Map()),pinch=useRef(null),pan=useRef(null),safariGesture=useRef(null);
 const worldAt=client=>{const bounds=contentRef.current.getBoundingClientRect();return [(client[0]-bounds.left)/renderedZoom.current,(client[1]-bounds.top)/renderedZoom.current];};
 function applyAnchor(){
  const node=viewportRef.current,content=contentRef.current,saved=anchor.current;if(!node||!content||!saved)return;
  const bounds=content.getBoundingClientRect();node.scrollLeft+=bounds.left+saved.world[0]*renderedZoom.current-saved.client[0];node.scrollTop+=bounds.top+saved.world[1]*renderedZoom.current-saved.client[1];anchor.current=null;
 }
 function schedule(value,client,world=worldAt(client)){
  zoomRef.current=clampZoom(value);anchor.current={world,client};
  if(frame.current!==null)return;
  frame.current=requestAnimationFrame(()=>{frame.current=null;if(Math.abs(zoomRef.current-renderedZoom.current)<.000001)applyAnchor();else setZoom(zoomRef.current);});
 }
 const changeZoom=(value,origin)=>{const node=viewportRef.current;if(!node||!contentRef.current)return;const bounds=node.getBoundingClientRect();schedule(value,origin?[bounds.left+origin[0],bounds.top+origin[1]]:[bounds.left+node.clientWidth/2,bounds.top+node.clientHeight/2]);};
 useLayoutEffect(()=>{renderedZoom.current=zoom;applyAnchor();},[zoom]);
 useLayoutEffect(()=>{
  const node=viewportRef.current;if(!node)return;
  const measure=()=>setViewportWidth(node.clientWidth);measure();const observer=new ResizeObserver(measure);observer.observe(node);
  // Trackpad pinch arrives as Ctrl+wheel in Chromium/Firefox, and gesture events in Safari.
  const wheel=event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();if(safariGesture.current)return;cancelRef.current();const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?node.clientHeight:1);schedule(zoomRef.current*Math.exp(-delta*.01),[event.clientX,event.clientY]);};
  const gesturePoint=event=>{const b=node.getBoundingClientRect();return event.clientX||event.clientY?[event.clientX,event.clientY]:[b.left+node.clientWidth/2,b.top+node.clientHeight/2];};
  const gestureStart=event=>{event.preventDefault();cancelRef.current();const client=gesturePoint(event);safariGesture.current={zoom:zoomRef.current,world:worldAt(client)};};
  const gestureChange=event=>{event.preventDefault();const saved=safariGesture.current;if(saved)schedule(saved.zoom*event.scale,gesturePoint(event),saved.world);};
  const gestureEnd=event=>{event.preventDefault();safariGesture.current=null;};
  node.addEventListener('wheel',wheel,{passive:false});node.addEventListener('gesturestart',gestureStart,{passive:false});node.addEventListener('gesturechange',gestureChange,{passive:false});node.addEventListener('gestureend',gestureEnd,{passive:false});
  return()=>{observer.disconnect();if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;node.removeEventListener('wheel',wheel);node.removeEventListener('gesturestart',gestureStart);node.removeEventListener('gesturechange',gestureChange);node.removeEventListener('gestureend',gestureEnd);};
 },[]);
 const metrics=()=>{const[a,b]=[...touches.current.values()];return {distance:Math.hypot(b[0]-a[0],b[1]-a[1]),client:[(a[0]+b[0])/2,(a[1]+b[1])/2]};};
 function finishTouch(event){touches.current.delete(event.pointerId);if(pinch.current){event.preventDefault();event.stopPropagation();if(!touches.current.size)pinch.current=null;}}
 const captureHandlers={
  onPointerDownCapture(event){
   if(event.pointerType!=='touch')return;touches.current.set(event.pointerId,[event.clientX,event.clientY]);
   if(touches.current.size>=2){if(!pinch.current){const{distance,client}=metrics();pinch.current={distance,zoom:zoomRef.current,world:worldAt(client)};cancelRef.current();pan.current=null;}event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation();}
  },
  onPointerMoveCapture(event){if(touches.current.has(event.pointerId))touches.current.set(event.pointerId,[event.clientX,event.clientY]);if(!pinch.current)return;event.preventDefault();event.stopPropagation();if(touches.current.size!==2)return;const{distance,client}=metrics(),saved=pinch.current;schedule(saved.zoom*distance/Math.max(1,saved.distance),client,saved.world);},
  onPointerUpCapture:finishTouch,onPointerCancelCapture:finishTouch,
 };
 const startPan=event=>{const node=viewportRef.current;pan.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:node.scrollLeft,top:node.scrollTop};event.currentTarget.setPointerCapture(event.pointerId);return true;};
 const movePan=event=>{const saved=pan.current;if(!saved||saved.pointerId!==event.pointerId)return false;viewportRef.current.scrollLeft=saved.left+saved.x-event.clientX;viewportRef.current.scrollTop=saved.top+saved.y-event.clientY;return true;};
 const endPan=event=>{if(pan.current?.pointerId===event.pointerId)pan.current=null;};
 return {viewportRef,contentRef,viewportWidth,zoom,changeZoom,captureHandlers,startPan,movePan,endPan};
}
