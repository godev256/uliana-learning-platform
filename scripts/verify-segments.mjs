import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {clippedSpatialLine,spatialIntersection,edgePreservingLinePaths} from '../src/components/board-space.js';
import {solidEdges,projectSolid} from '../src/components/board-solids.js';
const v=index=>({kind:'vertex',index});
const unit={type:'viz-cube',edgePoints:[],intersectionPoints:[{id:'Q',position:[-.5,-1,-.5]}]};
const partial={kind:'segment',through:[v(0),{kind:'intersection',id:'Q'}]},crossing={through:[v(1),v(4)]};assert.equal(spatialIntersection(unit,partial,crossing),null,'A segment must not intersect beyond its ends');assert.deepEqual(spatialIntersection(unit,{through:partial.through},crossing),[0,-1,0]);
const projected={vertices:[[10,20],[40,50]]};const clipped=clippedSpatialLine({...unit,type:'viz-cube'},{kind:'segment',through:[v(0),v(1)]},projected,{x:0,y:0,width:100,height:100});assert.deepEqual(clipped.ends,[[10,20],[40,50]]);
// Every real edge must retain its own stroke, including lines built from interior edge points.
for(const type of ['cube','cuboid','tetrahedron','prism','pyramid']) for(const edge of solidEdges(type)) {
 const item={type:`viz-${type}`,edgePoints:[{id:'m',edge,t:.2},{id:'n',edge,t:.8}]};
 for(const through of [edge.map(v),['m','n'].map(id=>({kind:'point',id}))]) for(const rotation of [[0,0,0],[25,42,10]]) {
  const model=projectSolid(item.type,rotation,{x:200,y:200,width:500,height:500},true);
  const line={through},clip=clippedSpatialLine(item,line,model,{x:0,y:0,width:1000,height:1000});
  if(!clip)continue;
  const paths=edgePreservingLinePaths(item,line,clip);
  assert.equal(paths.solid,'','The edge itself must not receive the gray line stroke');
  assert.equal((paths.dashed.match(/M/g)||[]).length,2,'Only the two continuations remain visible');
 }
}
const diagonal={through:[v(0),v(6)]},projection=projectSolid('viz-cube',[0,0,0],{x:200,y:200,width:500,height:500},true);
assert.ok(edgePreservingLinePaths(unit,diagonal,clippedSpatialLine(unit,diagonal,projection,{x:0,y:0,width:1000,height:1000})).solid,'A diagonal must still be drawn through the solid');
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/board');const types=['cube','cuboid','tetrahedron','prism','pyramid'];await page.evaluate(types=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:5,items:types.map((type,page)=>({id:type,type:`viz-${type}`,page,color:'#2f493f',size:4,points:[[80,100],[800,650]],rotation:[0,0,0],edgePoints:[],intersectionPoints:[],spatialLines:[],spatialPlanes:[]}))})),types);await page.reload();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2'))),frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 for(const type of types) {
  const card=page.locator(`[data-shape-id="${type}"]`);await card.scrollIntoViewIfNeeded();await card.getByRole('button',{name:'Отрезок по точкам',exact:true}).click();await card.locator('[data-vertex="A"]').click();await card.locator('[data-vertex="C"]').click();await frame();assert.equal(await card.locator('[data-space-segment]').count(),1);assert.equal(await card.locator('[data-space-line]').count(),0);
  const distance=await card.evaluate(el=>{const path=el.querySelector('[data-space-segment]'),start=path.getPointAtLength(0),end=path.getPointAtLength(path.getTotalLength());return ['A','C'].map((name,i)=>{const vertex=el.querySelector(`[data-vertex="${name}"]`).closest('[data-vertex-index]').querySelector('circle');return Math.hypot((i?end:start).x-Number(vertex.getAttribute('cx')),(i?end:start).y-Number(vertex.getAttribute('cy')));});});assert.ok(distance.every(x=>x<.01),'Segment must stop exactly at the selected points');
  await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();assert.equal(await card.locator('[data-space-segment]').count(),0);await page.getByRole('button',{name:'Повторить',exact:true}).click();await frame();
  await card.getByRole('button',{name:'Продлить',exact:true}).click();await card.locator('[data-vertex="A"]').click();await card.locator('[data-vertex="C"]').click();await frame();assert.equal(await card.locator('[data-space-line]').count(),1);await card.getByRole('button',{name:'Отрезок по точкам',exact:true}).click();await card.locator('[data-vertex="A"]').click();await card.locator('[data-vertex="C"]').click();await frame();assert.equal(await card.locator('[data-space-segment]').count(),1);assert.equal(await card.locator('[data-space-line]').count(),1,'A line and segment through the same points must coexist');assert.equal(await card.locator('[data-space-line]').getAttribute('stroke'),'#466d85');
  const before=await card.locator('[data-space-segment]').getAttribute('d');await card.getByRole('button',{name:'Вращать',exact:true}).click();const body=card.locator('[data-viz-body]');await body.hover();const r=await body.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+30,r.y+r.height/2+15,{steps:10});await page.mouse.up();await frame();assert.notEqual(await card.locator('[data-space-segment]').getAttribute('d'),before);
 }
 const saved=await stored();await page.reload();assert.deepEqual(await stored(),saved);const cube=page.locator('[data-shape-id="cube"]');await cube.scrollIntoViewIfNeeded();await page.screenshot({path:'playwright-report/segments-desktop.png'});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();await(await download).saveAs('.local/segments.pdf');
 await cube.getByRole('button',{name:'Удалить построение',exact:true}).click();const path=cube.locator('[data-space-segment]');await path.scrollIntoViewIfNeeded();await frame();const hit=await path.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.35);return new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM()).toJSON();});await page.mouse.click(hit.x,hit.y);await frame();assert.equal(await cube.locator('[data-space-segment]').count(),0);assert.equal(await cube.locator('[data-space-line]').count(),1);assert.equal(await cube.count(),1);
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://127.0.0.1:5173/board');await mobile.evaluate(item=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:1,items:[{...item,page:0,rotation:[0,0,0],spatialLines:[]}]})),saved.items[0]);await mobile.reload();for(let j=0;j<4;j++){await mobile.getByRole('button',{name:'Приблизить лист',exact:true}).click();await mobile.waitForFunction(value=>document.querySelector('.board-zoom-reset').textContent===`${value}%`,100+j*25);}
 await mobile.getByRole('button',{name:'Отрезок по точкам',exact:true}).tap();for(const name of ['A','C'])await mobile.locator(`[data-vertex="${name}"]`).tap();await mobile.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].spatialLines.some(line=>line.kind==='segment'));assert.equal(await mobile.locator('[data-space-line]').count(),0);await mobile.screenshot({path:'playwright-report/segments-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Segment checks passed: all five figures, exact endpoints, bounded extensions, line/segment coexistence, finite intersection semantics, rotation, history, persistence, PDF, selective delete and mobile touch.');
} finally {await browser.close();}
