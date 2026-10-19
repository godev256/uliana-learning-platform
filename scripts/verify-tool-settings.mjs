import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:5188,strictPort:true}});await server.listen();
try{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{for(const width of [1440,390,320,768]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5188/board');await page.evaluate(()=>document.fonts.ready);
 const paper=page.locator('.board-paper').first(),pen=page.getByRole('button',{name:'Ручка',exact:true}),marker=page.getByRole('button',{name:'Выделитель',exact:true}),dialog=page.getByRole('dialog');
 const top=(await paper.boundingBox()).y;await pen.click();await dialog.waitFor();assert.equal(await pen.getAttribute('aria-expanded'),'true');
 const a=await pen.boundingBox(),b=await dialog.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1);assert.ok(b.y>=0&&b.y+b.height<=900);if(width>1024){assert.ok(Math.abs(b.y-a.y-a.height-8)<2);assert.ok(Math.abs(a.x-b.x)<2);}else{assert.ok(Math.abs(b.x-a.x-a.width-8)<2);assert.ok(Math.abs(b.y-a.y)<2);}
 assert.ok(Math.abs((await paper.boundingBox()).y-top)<1,'Opening settings must not move the sheet');
 await dialog.getByRole('button',{name:'Синий',exact:true}).click();await dialog.getByRole('slider',{name:'Толщина ручки',exact:true}).fill('8');assert.equal(await dialog.locator('output').textContent(),'8');
 await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.ok(await pen.evaluate(node=>node===document.activeElement));
 await marker.click();await dialog.getByRole('button',{name:'Розовый',exact:true}).click();await dialog.getByRole('slider',{name:'Толщина выделителя',exact:true}).fill('48');await marker.click();assert.equal(await dialog.count(),0);
 await pen.click();assert.equal(await dialog.getByRole('button',{name:'Синий',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await dialog.getByRole('slider').inputValue(),'8');await marker.click();assert.equal(await dialog.getByRole('button',{name:'Розовый',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await dialog.getByRole('slider').inputValue(),'48');
 await page.screenshot({path:`playwright-report/tool-settings-${engine.name()}-${width}.png`});
 // Clicking the paper closes the settings and draws with the chosen marker.
 await page.locator('.board-sheet-viewport').evaluate(node=>{node.scrollLeft=0;node.scrollTop=0;});const box=await paper.boundingBox(),x=box.x+box.width*.6,y=box.y+5;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y+10,{steps:5});await page.mouse.up();assert.equal(await dialog.count(),0);
 const item=await paper.locator('[data-shape-type="highlighter"]').last();assert.equal(await item.getAttribute('stroke'),'#ed94b6');assert.equal(await item.getAttribute('stroke-width'),'48');
 await pen.click();await page.getByRole('button',{name:'Ластик',exact:true}).click();assert.equal(await dialog.getAttribute('aria-label'),'Настройки ластика');assert.deepEqual(errors,[]);
 console.log(`${engine.name()} ${width}: nearby popup, viewport bounds, independent settings, live width/color, keyboard/outside close, accurate marker drawing, stable sheet passed.`);await page.close();
}}finally{await browser.close();}}}finally{await server.close();}
