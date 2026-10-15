import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spatialIntersection,sanitizeConstructions} from '../src/components/board-space.js';
const vertex=index=>({kind:'vertex',index});
const fixture=()=>({id:'cube',type:'viz-cube',page:0,color:'#2f493f',size:4,points:[[80,100],[800,650]],rotation:[0,0,0],edgePoints:[],intersectionPoints:[],spatialLines:[{id:'AC',through:[vertex(0),vertex(5)]},{id:'BD',through:[vertex(1),vertex(4)]}]});
const base=fixture();assert.deepEqual(spatialIntersection(base,...base.spatialLines),[0,-1,0]);
assert.equal(spatialIntersection(base,{through:[vertex(0),vertex(1)]},{through:[vertex(5),vertex(6)]}),null,'Skew lines must not create false spatial intersections');
assert.equal(spatialIntersection(base,{through:[vertex(0),vertex(1)]},{through:[vertex(4),vertex(5)]}),null,'Parallel lines have no unique intersection');
assert.equal(spatialIntersection(base,base.spatialLines[0],base.spatialLines[0]),null,'Coincident lines have no unique intersection');
const invalid={...base,intersectionPoints:[{id:'broken',label:'M',lines:['missing','AC']}],spatialLines:[...base.spatialLines,{id:'dependent',through:[{kind:'intersection',id:'broken'},vertex(3)]}]};
assert.equal(sanitizeConstructions(invalid).intersectionPoints.length,0);assert.equal(sanitizeConstructions(invalid).spatialLines.length,2);
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/board');
 await page.evaluate(item=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:1,items:[item]})),fixture());await page.reload();
 const card=page.locator('[data-shape-id="cube"]'),stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0]),frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await page.getByRole('button',{name:'Продлить ребро',exact:true}).count(),0);
 await card.getByRole('button',{name:'Точка пересечения',exact:true}).click();const candidate=card.locator('[data-intersection-candidate]').first();await candidate.scrollIntoViewIfNeeded();await frame();let r=await candidate.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].intersectionPoints.length===1);
 const marked=await stored(),mark=marked.intersectionPoints[0];assert.equal(mark.label,'M');assert.deepEqual(mark.position,[0,-1,0]);assert.deepEqual(mark.lines,['AC','BD']);
 await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await frame();assert.equal((await stored()).intersectionPoints.length,1,'Repeated click must not duplicate an intersection');
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();assert.equal((await stored()).intersectionPoints.length,0);await page.getByRole('button',{name:'Повторить',exact:true}).click();await frame();
 await card.getByRole('button',{name:'Прямая по точкам',exact:true}).click();await card.locator('[data-intersection-point-id] text').click();await card.locator('[data-vertex="A₁"]').click();await frame();
 assert.equal((await stored()).spatialLines.length,3);assert.equal((await stored()).spatialLines[2].through[0].kind,'intersection','Marked intersections must be reusable for new lines');
 await card.getByRole('button',{name:'Вращать',exact:true}).click();const body=card.locator('[data-viz-body]');await body.hover();r=await body.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+40,r.y+r.height/2+20,{steps:10});await page.mouse.up();await frame();
 assert.deepEqual((await stored()).intersectionPoints,marked.intersectionPoints);
 const distance=await card.evaluate(el=>{
  const dot=el.querySelector('[data-intersection-point-id] circle:last-of-type'),p=[Number(dot.getAttribute('cx')),Number(dot.getAttribute('cy'))];
  return [...el.querySelectorAll('[data-space-line]')].slice(0,2).map(path=>{const a=path.getPointAtLength(0),b=path.getPointAtLength(path.getTotalLength());return Math.abs((b.x-a.x)*(p[1]-a.y)-(b.y-a.y)*(p[0]-a.x))/Math.hypot(b.x-a.x,b.y-a.y);});
 });assert.ok(distance.every(x=>x<.01),'The point must stay on both rotated lines');
 const saved=await stored();await page.reload();assert.deepEqual(await stored(),saved);await card.scrollIntoViewIfNeeded();await page.screenshot({path:'playwright-report/intersection-desktop.png'});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();await(await download).saveAs('.local/intersections.pdf');
 await page.getByRole('button',{name:'Ластик',exact:true}).click();await card.locator('[data-intersection-point-id] circle').last().click();await frame();assert.equal((await stored()).intersectionPoints.length,0);assert.equal((await stored()).spatialLines.length,2,'Removing the point must remove its dependent line');
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();assert.equal((await stored()).intersectionPoints.length,1);
 // Removing one source line also removes the intersection and all constructions using it.
 await card.locator('[data-spatial-line-id="AC"] path').first().scrollIntoViewIfNeeded();await frame();
 const p=await card.locator('[data-spatial-line-id="AC"] path').first().evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.1);return new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM()).toJSON();});await page.mouse.click(p.x,p.y);await frame();assert.equal((await stored()).intersectionPoints.length,0);assert.equal((await stored()).spatialLines.length,1);
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://127.0.0.1:5173/board');await mobile.evaluate(item=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:1,items:[item]})),fixture());await mobile.reload();
 for(let i=0;i<4;i++){await mobile.getByRole('button',{name:'Приблизить лист',exact:true}).click();await mobile.waitForFunction(value=>document.querySelector('.board-zoom-reset').textContent===`${value}%`,125+i*25);}
 await mobile.getByRole('button',{name:'Точка пересечения',exact:true}).tap();const target=mobile.locator('[data-intersection-candidate]').first();await target.scrollIntoViewIfNeeded();await mobile.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));r=await target.boundingBox();await mobile.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await mobile.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].intersectionPoints.length===1);
 await mobile.screenshot({path:'playwright-report/intersection-mobile.png'});assert.deepEqual(errors,[]);console.log('Intersection checks passed: removed extension button, true 3D intersections, parallel/skew rejection, labels, snapping, reuse in new lines, rotation, history, persistence, dependency cleanup, PDF and mobile touch.');
} finally {await browser.close();}
