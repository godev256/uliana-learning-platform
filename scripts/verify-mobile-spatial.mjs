import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/board');await page.evaluate(()=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:1,items:[{id:'prism',type:'viz-prism',page:0,points:[[80,100],[800,650]],rotation:[0,0,0],color:'#2f493f',size:4,edgePoints:[],spatialLines:[]}]})));await page.reload();
 const card=page.locator('[data-shape-id="prism"]');
 for(let i=0;i<4;i++) {await page.getByRole('button',{name:'Приблизить лист',exact:true}).click();await page.waitForFunction(value=>document.querySelector('.board-zoom-reset').textContent===`${value}%`,125+i*25);}
 const waitFrame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await card.getByRole('button',{name:'Точка на ребре',exact:true}).tap();
 for(const [index,t] of [[0,.3],[2,.65]]) {
  const edge=card.locator('[data-viz-edge]').nth(index);await edge.scrollIntoViewIfNeeded();await waitFrame();
  const p=await edge.evaluate((el,t)=>{const p=el.getPointAtLength(el.getTotalLength()*t);return new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM()).toJSON();},t);await page.touchscreen.tap(p.x,p.y);await waitFrame();
 }
 const item=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0]);const marked=await item();assert.equal(marked.edgePoints.length,2);
 await card.getByRole('button',{name:'Прямая по точкам',exact:true}).tap();
 for(const point of marked.edgePoints) {const circle=card.locator(`[data-edge-point-id="${point.id}"] circle`).last();await circle.scrollIntoViewIfNeeded();await waitFrame();const r=await circle.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await waitFrame();}
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].spatialLines.length===1);
 await card.getByRole('button',{name:'Вращать',exact:true}).tap();const body=card.locator('[data-viz-body]');await body.scrollIntoViewIfNeeded();await waitFrame();
 const r=await body.boundingBox(),view=await page.locator('.board-workspace').boundingBox(),x=Math.max(view.x+50,Math.min(view.x+view.width-60,r.x+r.width/2)),y=Math.max(view.y+60,Math.min(view.y+view.height-80,r.y+r.height/2));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30,y:y+15}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].rotation.some(x=>Math.abs(x)>1));assert.equal((await item()).spatialLines.length,1);
 await page.screenshot({path:'playwright-report/mobile-spatial.png'});assert.deepEqual(errors,[]);console.log('Mobile spatial checks passed: zoomed compact prism, touch edge markers, line through markers and rotation with attached constructions.');
} finally {await browser.close();}
