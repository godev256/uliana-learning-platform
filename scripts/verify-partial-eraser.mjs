import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {cutInkPolyline} from '../src/components/board-eraser.js';
// A sparse line is split at the geometric circle boundaries, not at samples.
assert.deepEqual(cutInkPolyline([[0,0],[100,0]],[[50,0]],10),[[[0,0],[40,0]],[[60,0],[100,0]]]);
assert.equal(cutInkPolyline([[0,0],[100,0]],[[50,30]],10),null);
assert.deepEqual(cutInkPolyline([[0,0],[100,0]],[[20,-30],[80,30]],10).map(chunk=>chunk.length),[2,2]);
assert.deepEqual(cutInkPolyline([[50,0]],[[50,0]],10),[]);
const server=await createServer({server:{host:'127.0.0.1',port:5198,strictPort:true}});await server.listen();
const ink=(id,points,type='pen',page=0)=>({id,points,type,page,size:type==='highlighter'?30:3,color:type==='highlighter'?'#83c98b':'#212123',smoothing:2,smoothingDistance:4});
const fixture={pageCount:2,items:[ink('line',[[200,350],[1000,350]]),ink('marker',[[200,600],[1000,600]],'highlighter'),ink('other-page',[[200,350],[1000,350]],'pen',1),{id:'rect',page:0,type:'rect',color:'#212123',size:3,points:[[300,200],[800,700]]}]};
try{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5198/board');await page.evaluate(book=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify(book)),fixture);await page.reload();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2'))),paper=page.locator('.board-paper').first();
 const screen=points=>paper.evaluate((svg,points)=>points.map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return [p.x,p.y];}),points);
 const eraser=page.getByRole('button',{name:'Ластик',exact:true});await eraser.click();
 const dialog=page.getByRole('dialog',{name:'Настройки ластика',exact:true});await dialog.waitFor();
 const b=await dialog.boundingBox(),a=await eraser.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1);if(width>1024)assert.ok(Math.abs(b.y-a.y-a.height-8)<2);else assert.ok(Math.abs(b.x-a.x-a.width-8)<2);
 assert.equal(await dialog.getByRole('button',{name:'Штрих целиком',exact:true}).getAttribute('aria-pressed'),'true');
 await dialog.getByRole('button',{name:'Часть штриха',exact:true}).click();await dialog.getByRole('slider',{name:'Толщина ластика',exact:true}).fill('16');assert.equal(await dialog.locator('output').textContent(),'16');
 await page.screenshot({path:`playwright-report/partial-eraser-settings-${engine.name()}-${width}.png`});await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
 const [center]=await screen([[600,350]]);await page.mouse.click(...center);
 let book=await stored(),pieces=book.items.filter(i=>i.type==='pen'&&i.page===0);
 assert.equal(pieces.length,2);assert.equal(pieces[0].points[0][0],200);assert.equal(pieces[1].points.at(-1)[0],1000);assert.ok(pieces[0].points.at(-1)[0]<600&&pieces[1].points[0][0]>600);
 assert.ok(pieces.every(i=>i.size===3&&i.color==='#212123'));assert.equal(book.items.find(i=>i.id==='rect').type,'rect');assert.ok(book.items.some(i=>i.id==='other-page'));
 await page.getByRole('button',{name:'Отменить',exact:true}).click();assert.deepEqual(await stored(),fixture);await page.getByRole('button',{name:'Повторить',exact:true}).click();assert.equal((await stored()).items.filter(i=>i.type==='pen'&&i.page===0).length,2);
 // A single fast pass through the marker cuts its middle, retaining both ends.
 const pts=await screen([[600,500],[600,700]]);await page.mouse.move(...pts[0]);await page.mouse.down();await page.mouse.move(...pts[1]);await page.mouse.up();
 assert.equal((await stored()).items.filter(i=>i.type==='highlighter').length,2);assert.ok((await stored()).items.filter(i=>i.type==='highlighter').every(i=>i.color==='#83c98b'&&i.size===30));
 const saved=await stored();await page.reload();assert.deepEqual(await stored(),saved);
 // Switching tools preserves the chosen thickness and mode until the board closes.
 await eraser.click();await dialog.getByRole('button',{name:'Часть штриха',exact:true}).click();await dialog.getByRole('slider').fill('40');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Ручка',exact:true}).click();await page.keyboard.press('Escape');await eraser.click();assert.equal(await dialog.getByRole('slider').inputValue(),'40');assert.equal(await dialog.getByRole('button',{name:'Часть штриха',exact:true}).getAttribute('aria-pressed'),'true');
 await dialog.getByRole('button',{name:'Штрих целиком',exact:true}).click();await page.keyboard.press('Escape');
 const [left]=await screen([[300,350]]);await page.mouse.click(...left);assert.equal((await stored()).items.filter(i=>i.type==='pen'&&i.page===0).length,1);
 // Cutting a smooth curve preserves the visible writing away from the cut.
 const curve=ink('curve',[[200,350],[350,250],[500,230],[650,250],[850,350]]);
 await page.evaluate(book=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify(book)),{pageCount:2,items:[curve]});await page.reload();
 const sample=await paper.locator('[data-shape-id="curve"]').evaluate(node=>{
  const length=node.getTotalLength(),at=t=>{const p=node.getPointAtLength(length*t);return [p.x,p.y];};
  const p=at(.5),screen=new DOMPoint(...p).matrixTransform(node.getScreenCTM());return {ends:[at(.1),at(.9)],screen:[screen.x,screen.y]};
 });
 await eraser.click();await dialog.getByRole('button',{name:'Часть штриха',exact:true}).click();await page.keyboard.press('Escape');await page.mouse.click(...sample.screen);
 assert.equal((await stored()).items.length,2);
 const kept=await paper.locator('[data-shape-type="pen"]').evaluateAll((nodes,points)=>points.every(point=>nodes.some(node=>node.isPointInStroke(new DOMPoint(...point)))) ,sample.ends);assert.ok(kept,'Curved ink outside the erased area must keep its shape');
 // Pointer cancellation restores the full state, including newly split fragments.
 const beforeCancel=await stored();await paper.evaluate(svg=>svg.addEventListener('pointerdown',event=>svg.testPointer=event.pointerId));
 const [near]=await screen([[250,320]]);await page.mouse.move(...near);await page.mouse.down();await page.mouse.move(near[0]+20,near[1]);
 await paper.evaluate(svg=>svg.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:svg.testPointer,pointerType:'mouse'})));await page.mouse.up();assert.deepEqual(await stored(),beforeCancel);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();assert.equal(await(await download).failure(),null);
 assert.deepEqual(errors,[]);console.log(`${engine.name()} ${width}: nearby eraser settings, thickness, partial pen/marker clipping, intact ends/geometry/other page, undo/redo, fast sweep, persistence, mode switch and PDF passed.`);await page.close();
}}finally{await browser.close();}}}finally{await server.close();}
