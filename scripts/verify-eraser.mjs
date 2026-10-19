import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:5195,strictPort:true}});await server.listen();
const ink=(id,points,type='pen',size=2,page=0)=>({id,type,points,color:'#212123',size,page,smoothing:1});
const fixture={pageCount:2,items:[
 ink('thin',[[400,200],[400,450]]),ink('overlap',[[400,200],[400,450]],'pen',4),
 ink('marker',[[450,300],[520,300]],'highlighter',36),ink('dot',[[600,300]],'pen',4),
 ink('far',[[850,200],[850,450]]),ink('other-page',[[400,200],[400,450]],'pen',2,1),
 {id:'screenshot',type:'image',page:0,color:'#212123',size:4,src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',points:[[200,100],[700,700]]},
 {id:'geometry',type:'rect',page:0,color:'#212123',size:4,points:[[250,150],[650,500]]},
]};
try{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5195/board');
 const load=async book=>{await page.evaluate(book=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify(book)),book);await page.reload();await page.getByRole('button',{name:'Ластик',exact:true}).click();};
 const paper=page.locator('.board-paper').first(),stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')));
 const screen=points=>paper.evaluate((svg,points)=>points.map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return [p.x,p.y];}),points);
 await load(fixture);
 let pts=await screen([[250,300],[650,300]]);
 await page.mouse.move(...pts[0]);await page.mouse.down();await page.mouse.move(...pts[1]);await page.mouse.up();
 assert.deepEqual((await stored()).items.map(i=>i.id),['far','other-page','screenshot','geometry'],'One fast movement must erase every intersected stroke, including overlaps and a dot');
 await page.getByRole('button',{name:'Отменить',exact:true}).click();assert.deepEqual(await stored(),fixture,'One undo restores the complete eraser gesture');
 await page.getByRole('button',{name:'Повторить',exact:true}).click();assert.equal((await stored()).items.length,4);
 // The effective radius is in screen pixels, including on a small zoomed sheet.
 for(const zoom of ['50%','175%']){
  await load({pageCount:2,items:[ink('target',[[400,200],[400,600]])]});
  await page.getByRole('button',{name:'Уменьшить лист',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.board-zoom-reset').textContent==='50%');
  if(zoom==='175%')for(let i=0;i<5;i++){await page.getByRole('button',{name:'Приблизить лист',exact:true}).click();await page.waitForFunction(value=>document.querySelector('.board-zoom-reset').textContent===value,`${75+i*25}%`);}
  assert.equal(await page.getByRole('button',{name:'Исходный размер листа',exact:true}).textContent(),zoom);
  await page.locator('.board-sheet-viewport').evaluate(node=>{node.scrollTop=0;node.scrollLeft=0;});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const [p]=await screen([[400,300]]);
  assert.ok(p[0]>0&&p[0]+22<width&&p[1]>100&&p[1]<1000,'Test point must be visible after zooming');
  await page.mouse.click(p[0]+22,p[1]);assert.equal((await stored()).items.length,1,'Nearby unrelated writing must remain');
  await page.mouse.click(p[0]+9,p[1]);assert.equal((await stored()).items.length,0,`A 9px near miss must erase at ${zoom}`);
 }
 // The lift-off event completes the sweep even without an intervening move.
 await load(fixture);await paper.evaluate(svg=>svg.addEventListener('pointerdown',event=>svg.testPointer=event.pointerId));
 pts=await screen([[250,300],[650,300]]);await page.mouse.move(...pts[0]);await page.mouse.down();
 await paper.evaluate((svg,[clientX,clientY])=>svg.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:svg.testPointer,pointerType:'mouse',clientX,clientY})),pts[1]);await page.mouse.up();assert.equal((await stored()).items.length,4);
 await load(fixture);await paper.evaluate(svg=>svg.addEventListener('pointerdown',event=>svg.testPointer=event.pointerId));pts=await screen([[250,300],[650,300]]);
 await page.mouse.move(...pts[0]);await page.mouse.down();await page.mouse.move(...pts[1]);
 await paper.evaluate(svg=>svg.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:svg.testPointer,pointerType:'mouse'})));await page.mouse.up();assert.deepEqual(await stored(),fixture);
 // Coalesced hardware samples retain a bent sweep that the endpoints alone miss.
 await load({pageCount:2,items:[ink('sampled',[[400,290],[400,330]])]});
 await paper.evaluate(svg=>svg.addEventListener('pointerdown',event=>svg.testPointer=event.pointerId));
 pts=await screen([[250,200],[400,310],[600,200]]);await page.mouse.move(...pts[0]);await page.mouse.down();
 await paper.evaluate((svg,samples)=>{
  const event=new PointerEvent('pointermove',{bubbles:true,pointerId:svg.testPointer,pointerType:'mouse',buttons:1,clientX:samples.at(-1)[0],clientY:samples.at(-1)[1]});
  Object.defineProperty(event,'getCoalescedEvents',{value:()=>samples.map(([clientX,clientY])=>({clientX,clientY}))});svg.dispatchEvent(event);
 },pts.slice(1));await page.mouse.up();assert.equal((await stored()).items.length,0);
 // Curved ink is hit where its displayed quadratic curve runs, not just at samples.
 const curved=ink('curve',[[200,250],[350,400],[500,450],[650,400],[800,250]]);
 await load({pageCount:2,items:[curved]});
 const spot=await paper.locator('[data-shape-id="curve"]').evaluate(node=>{const p=node.getPointAtLength(node.getTotalLength()*.5);return new DOMPoint(p.x,p.y).matrixTransform(node.getScreenCTM()).toJSON();});await page.mouse.click(spot.x,spot.y);assert.equal((await stored()).items.length,0);
 assert.deepEqual(errors,[]);console.log(`${engine.name()} ${width}: fast sweeps, overlapping ink, dots, screen radius at 50/175%, protected objects, page isolation, undo/redo/cancel, release and smooth curves passed.`);await page.close();
}}finally{await browser.close();}}}finally{await server.close();}
