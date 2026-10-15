import { useLayoutEffect, useRef, useState } from "react";

export const BOARD_TOUCH_QUERY = "(max-width: 640px), (any-pointer: coarse)";

const clampZoom = value => Math.max(1,Math.min(4,value));
export function useBoardViewport(cancelDrawing) {
  const viewportRef = useRef(null);
  const [zoom,setZoom] = useState(1);
  const zoomRef = useRef(1);
  const anchor = useRef(null);
  const touches = useRef(new Map());
  const pinch = useRef(null);
  const pan = useRef(null);
  const mobile = () => window.matchMedia(BOARD_TOUCH_QUERY).matches;
  const changeZoom = (value, origin) => {
    const node = viewportRef.current;
    if (!node || !mobile()) return;
    const next = clampZoom(value), previous = zoomRef.current;
    const position = origin ?? [node.clientWidth/2,node.clientHeight/2];
    anchor.current = { x:(node.scrollLeft+position[0])/previous, y:(node.scrollTop+position[1])/previous, position };
    zoomRef.current = next; setZoom(next);
  };
  useLayoutEffect(() => {
    const node = viewportRef.current, saved = anchor.current;
    if (!node || !saved) return;
    node.scrollLeft = saved.x*zoom-saved.position[0];
    node.scrollTop = saved.y*zoom-saved.position[1];
    anchor.current = null;
  },[zoom]);
  const metrics = () => {
    const [a,b] = [...touches.current.values()];
    const bounds = viewportRef.current.getBoundingClientRect();
    return {distance:Math.hypot(b[0]-a[0],b[1]-a[1]),position:[(a[0]+b[0])/2-bounds.left,(a[1]+b[1])/2-bounds.top]};
  };
  const captureHandlers = {
    onPointerDownCapture(event) {
      if (!mobile() || event.pointerType !== "touch") return;
      touches.current.set(event.pointerId,[event.clientX,event.clientY]);
      if (touches.current.size >= 2) {
        if (!pinch.current) {
          const {distance,position} = metrics(), node = viewportRef.current;
          pinch.current = { distance, zoom:zoomRef.current, x:(node.scrollLeft+position[0])/zoomRef.current, y:(node.scrollTop+position[1])/zoomRef.current };
          cancelDrawing(); pan.current = null;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault(); event.stopPropagation();
      }
    },
    onPointerMoveCapture(event) {
      if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId,[event.clientX,event.clientY]);
      if (!pinch.current) return;
      event.preventDefault(); event.stopPropagation();
      if (touches.current.size !== 2) return;
      const {distance,position} = metrics(), saved = pinch.current, node = viewportRef.current;
      const next = clampZoom(saved.zoom*distance/Math.max(1,saved.distance));
      anchor.current = {x:saved.x,y:saved.y,position};
      zoomRef.current = next; setZoom(next);
      // Panning still works when the pinch has reached its zoom limit.
      node.scrollLeft = saved.x*next-position[0]; node.scrollTop = saved.y*next-position[1];
    },
    onPointerUpCapture(event) { finishTouch(event); },
    onPointerCancelCapture(event) { finishTouch(event); },
  };
  function finishTouch(event) {
    touches.current.delete(event.pointerId);
    if (pinch.current) {
      event.preventDefault(); event.stopPropagation();
      if (!touches.current.size) pinch.current = null;
    }
  }
  const startPan = event => {
    if (!mobile()) return false;
    const node = viewportRef.current;
    pan.current = {pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:node.scrollLeft,top:node.scrollTop};
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  };
  const movePan = event => {
    const saved = pan.current;
    if (!saved || saved.pointerId !== event.pointerId) return false;
    viewportRef.current.scrollLeft = saved.left+saved.x-event.clientX;
    viewportRef.current.scrollTop = saved.top+saved.y-event.clientY;
    return true;
  };
  const endPan = event => { if (pan.current?.pointerId === event.pointerId) pan.current = null; };
  return {viewportRef,zoom,changeZoom,captureHandlers,startPan,movePan,endPan};
}
