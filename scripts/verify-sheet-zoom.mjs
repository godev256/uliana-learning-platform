import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:5183,strictPort:true}});await server.listen();
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch();
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5183/board');await page.evaluate(()=>document.fonts.ready);
  const paper=page.locator('.board-paper').first(),viewport=page.locator('.board-sheet-viewport'),pen=page.getByRole('button',{name:'Ручка',exact:true}),reset=page.getByRole('button',{name:'Исходный размер листа',exact:true}),minus=page.getByRole('button',{name:'Уменьшить лист',exact:true}),plus=page.getByRole('button',{name:'Приблизить лист',exact:true});
  assert.equal(await reset.textContent(),'75%');const initial=(await paper.boundingBox()).width,toolWidth=(await pen.boundingBox()).width;
  await minus.click();await page.waitForFunction(()=>document.querySelector('.board-zoom-reset').textContent==='50%');assert.ok(await minus.isDisabled());assert.ok(Math.abs((await paper.boundingBox()).width/initial-2/3)<.01);
  await plus.click();await plus.click();await page.waitForFunction(()=>document.querySelector('.board-zoom-reset').textContent==='100%');assert.ok(Math.abs((await paper.boundingBox()).width/initial-4/3)<.01);assert.ok(Math.abs((await pen.boundingBox()).width-toolWidth)<1);
  await reset.click();await page.waitForFunction(()=>document.querySelector('.board-zoom-reset').textContent==='75%');assert.ok(Math.abs((await paper.boundingBox()).width-initial)<1);
  // Drawing follows the pointer even below 100%.
  await viewport.evaluate(node=>{node.scrollTop=0;node.scrollLeft=0;});
  const box=await paper.boundingBox(),x=box.x+30,y=box.y+40;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y+30,{steps:5});await page.mouse.up();
  const endpoint=await paper.locator('[data-shape-type="pen"]').last().evaluate(node=>{const pt=node.getPointAtLength(node.getTotalLength());return new DOMPoint(pt.x,pt.y).matrixTransform(node.getScreenCTM()).toJSON();});assert.ok(Math.abs(endpoint.x-x-45)<2&&Math.abs(endpoint.y-y-30)<2);
  // Trackpad zoom respects the lower bound and keeps the tools fixed.
  await viewport.dispatchEvent('wheel',{ctrlKey:true,deltaY:300,clientX:x,clientY:y});await page.waitForFunction(()=>document.querySelector('.board-zoom-reset').textContent==='50%');assert.ok(Math.abs((await pen.boundingBox()).width-toolWidth)<1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await reset.click();await page.screenshot({path:`playwright-report/sheet-zoom-${engine.name()}-${width}.png`});console.log(`${engine.name()} ${width}px: 75% initial, 50% lower bound, zoom buttons/reset/trackpad, fixed tools, accurate ink passed.`);await page.close();
 }}finally{await browser.close();}
}}finally{await server.close();}
