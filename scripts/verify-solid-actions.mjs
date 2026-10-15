import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {solidGeometry,projectSolid} from '../src/components/board-solids.js';
import {spatialPoint,clippedSpatialLine} from '../src/components/board-space.js';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
for(const type of ['cube','cuboid','prism']) {
 const {vertices:v}=solidGeometry(type),up=sub(v[3],v[0]);
 for(const edge of [sub(v[1],v[0]),sub(v[type==='prism'?2:4],v[0])])assert.ok(Math.abs(dot(up,edge))<1e-8);
 const p=projectSolid(`viz-${type}`,[0,0,0],{x:0,y:0,width:1000,height:1000},true);assert.ok(Math.abs(p.vertices[0][0]-p.vertices[3][0])<1e-8);
}
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/board');
 await page.locator('summary[aria-label="Фигуры"]').click();await page.getByRole('button',{name:'Куб — 3D-визуализация',exact:true}).click();
 const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0]);
 assert.equal(initial.points[1][0]-initial.points[0][0],1440);assert.equal(initial.points[1][1]-initial.points[0][1],900);
 const types=['cube','cuboid','tetrahedron','prism','pyramid'];
 await page.evaluate(types=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:5,items:types.map((type,page)=>({id:type,type:`viz-${type}`,page,color:'#2f493f',size:4,rotation:[0,0,0],points:[[80,100],[800,650]],edgePoints:[],spatialLines:[]}))})),types);await page.reload();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2'))),item=async id=>(await stored()).items.find(x=>x.id===id),card=id=>page.locator(`[data-shape-id="${id}"]`);
 const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 async function drag(locator,dx,dy) {await locator.hover();const r=await locator.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:10});await page.mouse.up();await frame();}
 async function clickEdge(shape,index,t) {const edge=shape.locator('[data-viz-edge]').nth(index);await edge.scrollIntoViewIfNeeded();await frame();const p=await edge.evaluate((el,t)=>{const p=el.getPointAtLength(el.getTotalLength()*t);return new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM()).toJSON();},t);await page.mouse.click(p.x,p.y);await frame();}
 async function clickMark(shape,id) {const circle=shape.locator(`[data-edge-point-id="${id}"] circle`).last();await circle.scrollIntoViewIfNeeded();await frame();const r=await circle.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await frame();}
 const expected={cube:['A','B','C','D','A₁','B₁','C₁','D₁'],cuboid:['A','B','C','D','A₁','B₁','C₁','D₁'],tetrahedron:['A','B','C','D'],prism:['A','B','C','A₁','B₁','C₁'],pyramid:['A','B','C','D','E']};
 for(const type of types) {
  const shape=card(type);await shape.scrollIntoViewIfNeeded();assert.deepEqual(await shape.locator('[data-vertex]').allTextContents(),expected[type]);
  assert.equal(await shape.getByRole('button',{name:'Перемещать',exact:true}).count(),0);
  const original=await item(type);await page.getByRole('button',{name:'Ладошка',exact:true}).click();await drag(shape.locator('[data-viz-body]'),15,30);
  const moved=await item(type);assert.notDeepEqual(moved.points,original.points);assert.deepEqual(moved.rotation,original.rotation,'Hand must move the window without rotation');
  await shape.getByRole('button',{name:'Точка на ребре',exact:true}).click();await clickEdge(shape,0,.3);await clickEdge(shape,2,.65);
  const marked=await item(type);assert.equal(marked.edgePoints.length,2,`${type}: all models must support edge points`);assert.deepEqual(marked.edgePoints.map(x=>x.label),['M','N']);
  await shape.getByRole('button',{name:'Прямая по точкам',exact:true}).click();await clickMark(shape,marked.edgePoints[0].id);await clickMark(shape,marked.edgePoints[1].id);
  const connected=await item(type);assert.equal(connected.spatialLines.length,1);assert.equal(await shape.locator('[data-space-line]').count(),1);
  await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id===id).spatialLines.length===0,type);
  await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id===id).spatialLines.length===1,type);
  const before=await shape.locator('[data-space-line]').getAttribute('d');await shape.getByRole('button',{name:'Вращать',exact:true}).click();await drag(shape.locator('[data-viz-body]'),40,15);
  const rotated=await item(type);assert.notDeepEqual(rotated.rotation,moved.rotation);assert.deepEqual(rotated.points,moved.points);assert.deepEqual(rotated.edgePoints,marked.edgePoints);assert.deepEqual(rotated.spatialLines,connected.spatialLines);
  assert.notEqual(await shape.locator('[data-space-line]').getAttribute('d'),before,'Spatial lines must follow model rotation');
  const p=projectSolid(rotated.type,rotated.rotation,{x:0,y:0,width:800,height:600},true),line=clippedSpatialLine(rotated,rotated.spatialLines[0],p.vertices,{x:-100,y:-100,width:1200,height:1000});assert.ok(line);
  assert.deepEqual(line.a,spatialPoint(rotated,rotated.spatialLines[0].through[0],p.vertices));
  await shape.getByRole('button',{name:'Сбросить ракурс',exact:true}).click();await frame();assert.deepEqual((await item(type)).rotation,[0,0,0]);
 }
 const cube=card('cube');await cube.scrollIntoViewIfNeeded();
 await cube.getByRole('button',{name:'Прямая по точкам',exact:true}).click();
 const vertex=cube.locator('[data-vertex="A"]');await vertex.click();await cube.locator('[data-vertex="C₁"]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].spatialLines.length===2);
 const saved=await stored();await page.reload();assert.deepEqual(await stored(),saved,'Marks and spatial lines must survive reload');
 await cube.scrollIntoViewIfNeeded();await page.screenshot({path:'playwright-report/compact-spatial-solids.png'});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();await(await download).saveAs('.local/spatial-solids.pdf');
 await page.getByRole('button',{name:'Ластик',exact:true}).click();await clickMark(cube,saved.items[0].edgePoints[0].id);
 const erased=await item('cube');assert.equal(erased.edgePoints.length,1);assert.equal(erased.spatialLines.length,1,'Deleting a point must remove only lines depending on that point');assert.equal(await cube.count(),1);
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();assert.equal((await item('cube')).spatialLines.length,2);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('Spatial solids checks passed: large-window insertion, ordered vertices on all five solids, hand movement, rotation, edge points and infinite spatial lines on all solids, vertex lines, reset, history, persistence, dependent-line cleanup and PDF.');
} finally {await browser.close();}
