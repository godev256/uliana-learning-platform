import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
process.env.GO_API_URL='http://127.0.0.1:1';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
await mkdir('playwright-report',{recursive:true});
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{for(const [width,height] of [[390,844],[844,390],[820,1180],[1180,820]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let remote={pageCount:3,items:[]},revision=0;
  await page.route('**/api/account?**',route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='board'&&route.request().method()==='POST'){remote=route.request().postDataJSON().notebook;revision++;}return route.fulfill({json:action==='session'?{user:{id:'pupil-touch',login:'pupil',role:'student'}}:action==='topics'?{topics:[{id:'main',title:'Текущий урок',kind:'board'},{id:'geometry',title:'Геометрия',kind:'board'}]}:action==='board'?{notebook:remote,revision,student:{login:'pupil'},topic:{id:'main',kind:'board'}}:{}});});
  await page.goto(origin+'/cabinet/board/pupil-touch');await page.locator('.board-paper').first().waitFor();await page.waitForFunction(()=>document.querySelector('.board-sheet-viewport').scrollLeft===96&&document.querySelector('.board-sheet-viewport').scrollTop===96);
  const viewport=page.locator('.board-sheet-viewport'),tools=page.locator('.board-toolbar'),zoom=page.locator('.board-zoom-reset');
  const box=await viewport.boundingBox(),toolbar=await tools.boundingBox();assert.ok(box.width>=width-2,'Full screen width for sheet');assert.ok(box.height>=height-46,'Only compact header reserves vertical space');assert.equal(toolbar.width,44);assert.ok(toolbar.x>=box.x&&toolbar.x<box.x+60,'Tools float over the paper');
  for(const name of ['Ладошка','Ручка','Ластик','Отменить','Приблизить лист']){const b=await page.getByRole('button',{name,exact:true}).boundingBox();assert.ok(b&&b.width>=44&&b.height>=44&&b.y+b.height<=height,`${name} is touch-sized and onscreen`);}
  for(const name of ['Загрузить файл','Фигуры','Удалить лист'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
  const download=await page.getByRole('button',{name:'Скачать доску PDF',exact:true}).boundingBox(),line=await page.getByRole('button',{name:'Линия',exact:true}).boundingBox();assert.equal(download.x,line.x);assert.ok(download.y>=line.y+line.height,'Download follows line');
  const panX=async delta=>{const x=width*.5,y=box.y+Math.min(180,box.height*.5);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+delta,y,{steps:8});await page.mouse.up();await page.evaluate(()=>new Promise(requestAnimationFrame));};
  const paper=page.locator('.board-paper').first();const originalX=(await paper.boundingBox()).x;
  await panX(78);assert.ok((await paper.boundingBox()).x>=originalX+70,'Left edge moves out from underneath toolbar');
  await panX(-156);assert.ok((await paper.boundingBox()).x<originalX-50,'Sheet also moves left');await panX(78);
  const panY=async delta=>{const x=width*.5,y=box.y+Math.min(160,box.height*.45);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+delta,{steps:8});await page.mouse.up();await page.evaluate(()=>new Promise(requestAnimationFrame));};
  const originalY=(await paper.boundingBox()).y;await panY(88);assert.ok((await paper.boundingBox()).y>=originalY+80,'First sheet pulls down below topic button');await panY(-88);
  const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  // Real multi-touch input checks sheet-only pinch; the overlay must remain stationary.
  if(engine===chromium){const cdp=await context.newCDPSession(page),y=box.y+box.height*.5,x=width*.5;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-35,y},{x:x+35,y}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-35-i*7,y},{x:x+35+i*7,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frame();assert.ok(parseInt(await zoom.textContent())>150,'Pinch enlarges paper');await cdp.detach();
  }else{await page.getByRole('button',{name:'Приблизить лист',exact:true}).click();await frame();}
  await panY(4000);assert.ok((await paper.boundingBox()).y>=box.y+90,'Top reserve remains available after zoom');await panY(-96);
  const after=await tools.boundingBox();assert.deepEqual(after,toolbar,'Tools do not zoom or reserve a side column');
  await page.getByRole('button',{name:'Ручка',exact:true}).tap();await page.getByRole('button',{name:'Закрыть настройки',exact:true}).tap();
  const x=width*.5,y=box.y+Math.min(200,box.height*.45);
  if(engine===chromium){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*4,y:y+i*2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+32,y+16,{steps:8});await page.mouse.up();}
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-account-board:pupil-touch'))?.items?.some(i=>i.type==='pen'));
  await page.getByRole('button',{name:'Ладошка',exact:true}).tap();const scroll=await viewport.evaluate(n=>n.scrollTop);await page.mouse.move(x,y+40);await page.mouse.down();await page.mouse.move(x,y-40,{steps:6});await page.mouse.up();assert.ok(await viewport.evaluate(n=>n.scrollTop)>scroll,'Hand pans the enlarged sheet');
  await page.locator('.board-topic-rail summary').tap();await page.getByRole('button',{name:'Геометрия',exact:true}).tap();await page.waitForFunction(()=>{const node=document.querySelector('.board-topic-rail details');return node&&!node.open;});assert.ok(page.url().includes('topic=geometry'));
  await page.screenshot({path:`playwright-report/student-touch-${engine.name()}-${width}.png`});assert.deepEqual(errors,[]);console.log(`${engine.name()} ${width}x${height}: full viewport, overlay, touch drawing, zoom, pan, topic switching passed`);await context.close();
 }}finally{await browser.close();}
}}finally{await server.close();}
