import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spatialLinePoints,sanitizeConstructions,withoutConstruction,spatialIntersection} from '../src/components/board-space.js';
const ref=id=>({kind:'free',id});
const item={id:'xyz',page:0,type:'viz-space',color:'#2f493f',size:4,points:[[80,100],[1520,1000]],rotation:[0,0,0],freePoints:[{id:'M',label:'M',position:[0,1,0]},{id:'N',label:'N',position:[1,1,0]},{id:'P',label:'P',position:[0,0,1]}],spatialLines:[{id:'MN',through:[ref('M'),ref('N')]}]};
const parallel={id:'par',kind:'parallel',through:[ref('P')],parallelTo:{kind:'line',id:'MN'}};
assert.deepEqual(spatialLinePoints(item,parallel),[[0,0,1],[1,0,1]]);
const full={...item,spatialLines:[...item.spatialLines,parallel,{id:'second',kind:'parallel',through:[ref('M')],parallelTo:{kind:'line',id:'par'}}]};
assert.equal(sanitizeConstructions(full).spatialLines.length,3);
assert.equal(withoutConstruction(full,{kind:'line',id:'MN'}).spatialLines.length,0,'Delete a source and remove all dependent parallels');
assert.equal(withoutConstruction(full,{kind:'free',id:'P'}).spatialLines.length,1);
assert.deepEqual(spatialIntersection(full,parallel,{through:[ref('P'),ref('M')]}),[0,0,1]);
assert.equal(spatialLinePoints({...full,spatialLines:[{...parallel,parallelTo:{kind:'line',id:'par'}}]}, {...parallel,parallelTo:{kind:'line',id:'par'}}),null,'Cyclic sources must be rejected');
for(const type of ['cube','cuboid','tetrahedron','prism','pyramid']) {
 const solid={type:`viz-${type}`,edgePoints:[],spatialLines:[]};
 const edge=type==='tetrahedron'||type==='pyramid'?[1,2]:[0,1];
 const parallel={id:'edge-parallel',kind:'parallel',through:[{kind:'vertex',index:0}],parallelTo:{kind:'edge',edge}};
 assert.equal(sanitizeConstructions({...solid,spatialLines:[parallel]}).spatialLines.length,1,`${type}: parallel to edge survives load`);
 assert.equal(spatialLinePoints(solid,parallel).length,2);
}
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/board');await page.evaluate(item=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:1,items:[item]})),item);await page.reload();
 const card=page.locator('[data-shape-id="xyz"]'),frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))),stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0]);
 assert.equal(await page.getByRole('group',{name:'Рабочая плоскость',exact:true}).count(),0);
 async function clickPoint(id){const dot=card.locator(`[data-free-point-id="${id}"] circle`).last();await dot.scrollIntoViewIfNeeded();await frame();const b=await dot.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await frame();}
 await card.getByRole('button',{name:'Параллельная',exact:true}).click();await clickPoint('P');
 const path=card.locator('[data-spatial-line-id="MN"] [data-space-line]');await path.scrollIntoViewIfNeeded();await frame();const p=await path.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.75);return new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM()).toJSON();});await page.mouse.click(p.x,p.y);await frame();assert.equal((await stored()).spatialLines.length,2);assert.equal((await stored()).spatialLines[1].parallelTo.id,'MN');
 await card.getByRole('button',{name:'Вращать',exact:true}).click();const body=await card.locator('[data-viz-body]').boundingBox();await page.mouse.move(body.x+body.width/2,body.y+body.height/2);await page.mouse.down();await page.mouse.move(body.x+body.width/2+40,body.y+body.height/2+20,{steps:5});await page.mouse.up();await frame();
 const saved=await stored();await page.reload();assert.deepEqual(await stored(),saved);
 await card.getByRole('button',{name:'Добавить точку',exact:true}).click();
 // Axis placement after closing the coordinate-entry dialog.
 const axis=card.locator('[data-coordinate-axis="Z"] path').nth(1);await axis.scrollIntoViewIfNeeded();await frame();const a=await axis.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*2/3);return new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM()).toJSON();});await page.mouse.click(a.x,a.y);await frame();assert.deepEqual((await stored()).freePoints.at(-1).position,[0,0,2]);
 await page.screenshot({path:'playwright-report/parallel-xyz.png'});assert.deepEqual(errors,[]);console.log('Parallel lines passed: true world direction, dependencies, cycle rejection, intersections, browser point+line selection, rotation, persistence, axis placement and no plane chooser.');
}finally{await browser.close();}
