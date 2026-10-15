import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const vertex=index=>({kind:'vertex',index}),intersection=id=>({kind:'intersection',id});
const fixture=()=>({id:'cube',type:'viz-cube',page:0,color:'#2f493f',size:4,points:[[80,100],[800,650]],rotation:[0,0,0],edgePoints:[{id:'N',label:'N',edge:[0,1],t:.25}],intersectionPoints:[{id:'M',label:'M',lines:['AC','BD']}],spatialLines:[{id:'AC',through:[vertex(0),vertex(5)]},{id:'BD',through:[vertex(1),vertex(4)]},{id:'MA1',through:[intersection('M'),vertex(3)]}],spatialPlanes:[{id:'top',through:[vertex(3),vertex(2),vertex(6)]},{id:'base',through:[intersection('M'),vertex(0),vertex(1)]}]});
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/board');await page.evaluate(item=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:1,items:[item]})),fixture());await page.reload();
 const card=page.locator('[data-shape-id="cube"]'),stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0]),frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await card.locator('[data-space-line]').first().getAttribute('stroke'),'#c2ccd4');
 await card.getByRole('button',{name:'Удалить построение',exact:true}).click();assert.equal(await card.getByRole('button',{name:'Удалить построение',exact:true}).getAttribute('aria-pressed'),'true');
 async function clickActual(selector) {
  const target=card.locator(selector).first();await target.scrollIntoViewIfNeeded();await frame();
  const p=await target.evaluate((el,selector)=>{const r=el.getBoundingClientRect();for(let i=1;i<15;i++)for(let j=1;j<15;j++){const x=r.x+r.width*i/15,y=r.y+r.height*j/15;const hit=document.elementFromPoint(x,y)?.closest('[data-intersection-point-id], [data-edge-point-id], [data-spatial-line-id], [data-spatial-plane-id]');if(hit?.matches(selector))return {x,y};}return null;},selector);
  assert.ok(p,`Construction ${selector} must be visibly clickable`);await page.mouse.click(p.x,p.y);await frame();
 }
 await clickActual('[data-spatial-line-id="AC"]');let current=await stored();assert.equal(current.spatialLines.length,1);assert.equal(current.spatialLines[0].id,'BD');assert.equal(current.intersectionPoints.length,0);assert.equal(current.spatialPlanes.length,1);assert.equal(current.edgePoints.length,1);assert.equal(await card.count(),1);
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();assert.equal((await stored()).spatialLines.length,3);assert.equal((await stored()).spatialPlanes.length,2);
 await clickActual('[data-edge-point-id="N"]');assert.equal((await stored()).edgePoints.length,0);await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();
 await clickActual('[data-spatial-plane-id="top"]');assert.equal((await stored()).spatialPlanes.length,1);assert.equal((await stored()).spatialPlanes[0].id,'base');await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();
 const before=await stored();
 // Clicking empty model space must not remove the whole window.
 const bounds=await card.locator('[data-viz-body]').boundingBox();await page.mouse.click(bounds.x+bounds.width-5,bounds.y+5);await frame();assert.deepEqual(await stored(),before);assert.equal(await card.count(),1);
 await card.getByRole('button',{name:'Вращать',exact:true}).click();assert.equal(await card.getByRole('button',{name:'Удалить построение',exact:true}).getAttribute('aria-pressed'),'false');await page.screenshot({path:'playwright-report/local-delete.png'});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();await(await download).saveAs('.local/muted-constructions.pdf');
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://127.0.0.1:5173/board');await mobile.evaluate(item=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:1,items:[{...item,spatialPlanes:[],intersectionPoints:[],spatialLines:item.spatialLines.slice(0,1)}]})),fixture());await mobile.reload();
 for(let j=0;j<4;j++){await mobile.getByRole('button',{name:'Приблизить лист',exact:true}).click();await mobile.waitForFunction(value=>document.querySelector('.board-zoom-reset').textContent===`${value}%`,125+j*25);}
 await mobile.getByRole('button',{name:'Удалить построение',exact:true}).tap();const path=mobile.locator('[data-spatial-line-id="AC"] path').first();await path.scrollIntoViewIfNeeded();await mobile.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const p=await path.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.2);return new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM()).toJSON();});await mobile.touchscreen.tap(p.x,p.y);await mobile.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].spatialLines.length===0);assert.equal(await mobile.locator('[data-shape-id="cube"]').count(),1);
 assert.deepEqual(errors,[]);console.log('Local delete checks passed: header delete mode, muted lines, removal of lines/points/planes, dependent cleanup, undo, empty-space protection, exit mode, PDF and mobile touch.');
} finally {await browser.close();}
