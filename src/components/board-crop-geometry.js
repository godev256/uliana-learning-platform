const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function moveCrop(area,[dx,dy]){
 return {...area,x:clamp(area.x+dx,0,1-area.width),y:clamp(area.y+dy,0,1-area.height)};
}
// Handles go clockwise from the top-left corner. Opposite edges stay fixed.
export function resizeCrop(area,handle,[dx,dy]){
 let left=area.x,top=area.y,right=left+area.width,bottom=top+area.height;
 const min=.02;
 if([0,6,7].includes(handle))left=clamp(left+dx,0,right-min);
 if([2,3,4].includes(handle))right=clamp(right+dx,left+min,1);
 if([0,1,2].includes(handle))top=clamp(top+dy,0,bottom-min);
 if([4,5,6].includes(handle))bottom=clamp(bottom+dy,top+min,1);
 return {x:left,y:top,width:right-left,height:bottom-top};
}
