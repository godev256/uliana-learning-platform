import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
process.env.GO_API_URL='http://127.0.0.1:1';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const item=(id,type,page,points,extra={})=>({id,type,page,points,color:'#212123',size:3,...extra});
const book={pageCount:3,items:[item('photo','image',0,[[200,200],[800,650]],{src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII='}),item('box','rect',0,[[900,200],[1300,600]]),item('ink','pen',0,[[200,800],[650,850]]),item('file','attachment',0,[[100,1400],[800,1900]],{assetId:'fixture-only',name:'Урок.pdf',format:'pdf',pageCount:1}),item('cube','viz-cube',1,[[80,100],[1520,1000]],{rotation:[0,0,0]})]};
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{for(const width of [1440,390])for(const role of ['student','teacher']){
  const context=await browser.newContext({viewport:{width,height:950},hasTouch:width===390,isMobile:width===390,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  let remote=structuredClone(book),revision=0;const kind=role==='student'&&width===390?'pdf':'board';
  await page.route('**/api/account?**',route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='asset')return route.fulfill({status:404,json:{error:'No fixture asset'}});if(action==='board'&&route.request().method()==='POST'){remote=route.request().postDataJSON().notebook;revision++;}return route.fulfill({json:action==='session'?{user:{id:'student-preview',login:'preview',role}}:action==='topics'?{topics:[{id:'main',title:'Тест',kind}]}:action==='board'?{notebook:remote,revision,student:{login:'preview'},topic:{id:'main',kind}}:{}});});
  await page.goto(origin+'/cabinet/board/student-preview');await page.evaluate(()=>document.fonts.ready);await page.locator('.board-paper').first().waitFor();
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-account-board:student-preview'))),frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.waitForFunction(()=>localStorage.getItem('uliana-account-board:student-preview'));
  const hand=page.getByRole('button',{name:'Ладошка',exact:true}),viewport=page.locator('.board-sheet-viewport');
  if(role==='student'){
   assert.equal(await hand.getAttribute('aria-pressed'),'true','Student starts with navigation');
   for(const name of ['Клетка','+ Добавить лист','Удалить лист','Загрузить файл','Фигуры'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
   assert.equal(await page.locator('.board-grid-toggle,.board-figures,.board-selection-bar').count(),0);
   const before=await stored();
   for(const id of ['photo','box','ink','file','cube']){
    const target=page.locator(`[data-shape-id="${id}"]`).first();await target.scrollIntoViewIfNeeded();await frame();const r=await target.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2,scroll=await viewport.evaluate(el=>el.scrollTop);
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-10,y-45,{steps:8});await page.mouse.up();await frame();
    assert.deepEqual(await stored(),before,`Hand scroll over ${id} never moves or resizes it`);if(id==='photo')assert.ok(await viewport.evaluate(el=>el.scrollTop)>scroll,'Dragging over a photo scrolls the board');
   }
   assert.equal(await page.locator('[data-selection-controls],[data-marquee]').count(),0);assert.equal(await page.getByRole('dialog').count(),0,'Scrolling over a file never opens it');
   const zoomBefore=await page.locator('.board-zoom-reset').textContent();await page.getByRole('button',{name:'Приблизить лист',exact:true}).click();await frame();assert.notEqual(await page.locator('.board-zoom-reset').textContent(),zoomBefore);assert.deepEqual(await stored(),before);
   if(width===390&&engine.name()==='chromium'){
    const r=await viewport.boundingBox(),x=r.x+r.width/2,y=r.y+150;const cdp=await context.newCDPSession(page);const zoom=await page.locator('.board-zoom-reset').textContent();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-20,y},{x:x+20,y}]});for(let step=1;step<=5;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-20-step*3,y},{x:x+20+step*3,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frame();assert.notEqual(await page.locator('.board-zoom-reset').textContent(),zoom,'Pinch remains available');assert.deepEqual(await stored(),before);await cdp.detach();
   }
   // The 3D window is fixed on the page, but students can still rotate its model.
   const cube=page.locator('[data-shape-id="cube"]');await cube.getByRole('button',{name:'Вращать',exact:true}).click();const body=cube.locator('[data-viz-body]');await body.scrollIntoViewIfNeeded();await frame();const r=await body.boundingBox(),view=await viewport.boundingBox(),x=Math.max(view.x+30,Math.min(view.x+view.width-40,r.x+r.width*.5)),y=Math.max(view.y+30,Math.min(view.y+view.height-50,r.y+r.height*.5));await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+25,y+15,{steps:8});await page.mouse.up();await frame();const rotated=await stored();assert.ok(rotated.items.find(item=>item.id==='cube').rotation.some(value=>value!==0));assert.deepEqual(rotated.items.map(item=>item.points),before.items.map(item=>item.points));
   // Dragging the header also scrolls rather than relocating the 3D window.
   const header=cube.locator('[data-viz-header]');await header.scrollIntoViewIfNeeded();const h=await header.boundingBox();await page.mouse.move(h.x+h.width*.2,h.y+h.height*.5);await page.mouse.down();await page.mouse.move(h.x+h.width*.2-15,h.y+h.height*.5-30,{steps:6});await page.mouse.up();assert.deepEqual((await stored()).items.map(item=>item.points),before.items.map(item=>item.points));
   await hand.click();await page.keyboard.press('Delete');assert.equal((await stored()).items.length,before.items.length,'Delete in navigation mode cannot remove selected 3D windows');
   await page.keyboard.press('KeyP');assert.equal(await page.getByRole('button',{name:'Ручка',exact:true}).getAttribute('aria-pressed'),'true','Student can still switch to writing');assert.equal((await stored()).pageCount,3);
  }else{
   assert.equal(await page.getByRole('button',{name:'Ручка',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.board-grid-toggle').count(),1);assert.equal(await page.getByRole('button',{name:'+ Добавить лист',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Удалить лист',exact:true}).count(),1);
   await hand.click();const photo=page.locator('[data-select-id="photo"]');await photo.scrollIntoViewIfNeeded();const r=await photo.boundingBox(),before=(await stored()).items.find(item=>item.id==='photo').points;await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.5+20,r.y+r.height*.5+15,{steps:6});await page.mouse.up();await frame();assert.notDeepEqual((await stored()).items.find(item=>item.id==='photo').points,before,'Teacher can still move objects');assert.equal(await page.getByRole('button',{name:'Обрезать',exact:true}).count(),1);
   await page.getByRole('button',{name:'Клетка',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Клетка',exact:true}).getAttribute('aria-pressed'),'false');await page.getByRole('button',{name:'+ Добавить лист',exact:true}).click();await frame();assert.equal((await stored()).pageCount,4);await page.getByRole('button',{name:'Отменить',exact:true}).click();await frame();assert.equal((await stored()).pageCount,3);
  }
  assert.deepEqual(errors,[]);console.log(`${engine.name()} ${width} ${role}: navigation, object positions, zoom, student controls and teacher permissions passed`);await context.close();
 }}finally{await browser.close();}
}}finally{await server.close();}
