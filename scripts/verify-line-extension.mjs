import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {beginDirectedExtension,dragDirectedExtension,clippedSpatialLine,sanitizeConstructions,spatialIntersection,spatialLinePoints} from '../src/components/board-space.js';
import {projectSolid} from '../src/components/board-solids.js';
const v=index=>({kind:'vertex',index}),types=['cube','cuboid','tetrahedron','prism','pyramid','space'];
const fixture=type=>({id:'model',type:`viz-${type}`,page:0,points:[[80,100],[1520,1000]],rotation:[0,0,0],color:'#2f493f',size:4,freePoints:[{id:'a',label:'M',position:[-1,0,0]},{id:'b',label:'N',position:[1,0,0]}],spatialLines:[{id:'segment',kind:'segment',through:type==='space'?[{kind:'free',id:'a'},{kind:'free',id:'b'}]:[v(0),v(1)]}]});
for(const type of types){
 const item=fixture(type),through=item.spatialLines[0].through,result=beginDirectedExtension(item,through,'unused');
 assert.deepEqual(result.item.spatialLines[0].range,[0,1],'Choosing points never adds automatic length');assert.equal(result.item.spatialLines.length,1);assert.equal(result.lineId,'segment');
 const model=projectSolid(item.type,[0,0,0],{x:0,y:0,width:800,height:600},true),projected=spatialLinePoints(result.item,result.item.spatialLines[0],model),[a,b]=projected;
 const target=b.map((value,index)=>value+(value-a[index])*.6),changed=dragDirectedExtension(result.item,result.lineId,projected,target);
 assert.equal(changed.spatialLines[0].range[0],0);assert.ok(Math.abs(changed.spatialLines[0].range[1]-1.6)<1e-8,'Only the side beyond the last point grows');
 const clip=clippedSpatialLine(changed,changed.spatialLines[0],model,{x:-10000,y:-10000,width:20000,height:20000});assert.ok(Math.abs(clip.start)<1e-8&&Math.abs(clip.end-1.6)<1e-8);
 const noDrag=dragDirectedExtension(result.item,result.lineId,projected,[b[0]+20,b[1]-15],[b[0]+20,b[1]-15]);assert.deepEqual(noDrag.spatialLines[0].range,[0,1],'Clicking a label without dragging does not create an extension');
 const backward=dragDirectedExtension(result.item,result.lineId,projected,a);assert.deepEqual(backward.spatialLines[0].range,[0,1],'Dragging toward the first point cannot extend the opposite side');
 const reversed=beginDirectedExtension(changed,[...through].reverse(),'duplicate');assert.equal(reversed.item.spatialLines.length,1);assert.deepEqual(reversed.item.spatialLines[0].through,[...through].reverse(),'Reversing selection reverses direction without duplicates');
 assert.deepEqual(sanitizeConstructions(changed).spatialLines[0].range,changed.spatialLines[0].range);assert.equal(beginDirectedExtension(item,[through[0],through[0]],'invalid'),null);
 assert.equal(beginDirectedExtension({...item,spatialLines:[]},through,'new').item.spatialLines.length,1,'Two points can define a new finite connection');
}
const crossing={...fixture('space'),freePoints:[...fixture('space').freePoints,{id:'c',label:'C',position:[3,-1,0]},{id:'d',label:'D',position:[3,1,0]}]};
const prepared=beginDirectedExtension(crossing,crossing.spatialLines[0].through,'unused'),finite={...prepared.item.spatialLines[0],range:[0,1.5]},other={through:[{kind:'free',id:'c'},{kind:'free',id:'d'}]};assert.equal(spatialIntersection(crossing,finite,other),null);assert.ok(spatialIntersection(crossing,{...finite,range:undefined},other));
for(const engine of [chromium,webkit].filter(engine=>!process.env.EXTENSION_ENGINE||engine.name()===process.env.EXTENSION_ENGINE)){
 const browser=await engine.launch();try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1100},hasTouch:width===390,isMobile:width===390,reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const type of width===1440?types:['cube','space']){
  const original=fixture(type);await page.goto('http://127.0.0.1:5173/board');await page.waitForLoadState('networkidle');await page.evaluate(item=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({pageCount:1,items:[item]})),original);await page.reload();
  const card=page.locator('[data-shape-id="model"]'),stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0]),frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  if(width===390){await page.getByRole('button',{name:'Приблизить лист',exact:true}).click();await frame();}
  await card.getByRole('button',{name:'Продлить',exact:true}).click();assert.equal(await card.getByRole('button',{name:'Прямая по точкам',exact:true}).count(),0);
  const pointNode=index=>type==='space'?card.locator(`[data-free-point-id="${index===0?'a':'b'}"] > circle`).last():card.locator(`[data-vertex-index="${index}"] > circle`);
  async function location(index){const node=pointNode(index);await node.scrollIntoViewIfNeeded();await frame();return node.evaluate(el=>new DOMPoint(Number(el.getAttribute('cx')),Number(el.getAttribute('cy'))).matrixTransform(el.getScreenCTM()).toJSON());}
  let a=await location(0);if(width===390)await page.touchscreen.tap(a.x,a.y);else await page.mouse.click(a.x,a.y);assert.equal((await stored()).spatialLines[0].kind,'segment','First point alone leaves the construction unchanged');
  const b=await location(1);a=await pointNode(0).evaluate(el=>new DOMPoint(Number(el.getAttribute('cx')),Number(el.getAttribute('cy'))).matrixTransform(el.getScreenCTM()).toJSON());
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),distance=24,target={x:b.x+dx/length*distance,y:b.y+dy/length*distance};
  if(width===390&&engine.name()==='chromium'){
   const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y}]});for(let step=1;step<=10;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+(target.x-b.x)*step/10,y:b.y+(target.y-b.y)*step/10}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{await page.mouse.move(b.x,b.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:10});await page.mouse.up();}
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].spatialLines[0].range?.[1]>1.01);
  const grown=await stored();assert.equal(grown.spatialLines.length,1);assert.equal(grown.spatialLines[0].range[0],0);assert.ok(Math.abs(grown.spatialLines[0].range[1]-(1+distance/length))<.12,'The dragged distance controls the exact length');assert.equal(await card.locator('[data-extend-end="0"]').count(),0);assert.equal(await card.locator('[data-extend-end="1"]').count(),1);
  await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();assert.equal((await stored()).spatialLines[0].kind,'segment');assert.equal((await stored()).spatialLines[0].range,undefined);await page.getByRole('button',{name:'Повторить',exact:true}).click();await frame();assert.deepEqual((await stored()).spatialLines,grown.spatialLines);
  // Reverse point order, now extending beyond the former first point.
  await card.getByRole('button',{name:'Продлить',exact:true}).click();let from=await location(1);await page.mouse.click(from.x,from.y);let last=await location(0);from=await pointNode(1).evaluate(el=>new DOMPoint(Number(el.getAttribute('cx')),Number(el.getAttribute('cy'))).matrixTransform(el.getScreenCTM()).toJSON());const reverseDx=last.x-from.x,reverseDy=last.y-from.y,reverseLength=Math.hypot(reverseDx,reverseDy);await page.mouse.move(last.x,last.y);await page.mouse.down();await page.mouse.move(last.x+reverseDx/reverseLength*18,last.y+reverseDy/reverseLength*18,{steps:8});await page.mouse.up();await frame();const reversed=await stored();assert.equal(reversed.spatialLines.length,1);assert.equal(reversed.spatialLines[0].range[0],0);assert.ok(reversed.spatialLines[0].range[1]>1);assert.deepEqual(reversed.spatialLines[0].through,[...original.spatialLines[0].through].reverse());
  await page.reload();assert.deepEqual((await stored()).spatialLines,reversed.spatialLines,'Direction and length survive reload');
  // A tap at each point must create zero extra length.
  await card.getByRole('button',{name:'Продлить',exact:true}).click();for(const index of [0,1]){const p=await location(index);if(width===390)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}await frame();assert.deepEqual((await stored()).spatialLines[0].through,original.spatialLines[0].through);assert.deepEqual((await stored()).spatialLines[0].range,[0,1]);
  if(type==='cube'&&width===1440){await page.screenshot({path:`playwright-report/directed-extension-${engine.name()}.png`});const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();assert.match((await download).suggestedFilename(),/\.pdf$/);}
 }
 assert.deepEqual(errors,[]);console.log(`${engine.name()} ${width}: first point + drag from second, one-sided exact length, reversed direction, touch, no auto-length, undo/redo, persistence and PDF passed`);await page.close();
 }}finally{await browser.close();}
}
