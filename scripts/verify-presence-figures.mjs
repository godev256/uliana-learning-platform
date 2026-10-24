import assert from 'node:assert/strict';
import {mkdir,rm} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,webkit,request} from 'playwright';
process.env.ACCOUNTS_DB_PATH=`.local/presence-${process.pid}.sqlite`;
const server=await createServer({server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();const origin='http://127.0.0.1:5196',browser=await(process.env.BOARD_BROWSER==='webkit'?webkit:chromium).launch();await mkdir('playwright-report',{recursive:true});let t,s;
try{
 const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});await api.post('/api/account?action=setup',{data:{login:'teacher',password:'Teacher-cursors-12345'}});const owner=(await(await api.post('/api/account?action=students',{data:{login:'pupil01',password:'Student-cursors-12345'}})).json()).student;
 const other=(await(await api.post('/api/account?action=topics',{data:{studentId:owner.id,operation:'create',title:'Другая тема'}})).json()).topic;
 const path=`/api/account?action=board&studentId=${owner.id}`,load=async()=>(await(await api.get(path)).json());
 const tc=await browser.newContext({storageState:await api.storageState(),viewport:{width:1440,height:1000}}),sc=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});await sc.request.post(origin+'/api/account?action=login',{data:{login:'pupil01',password:'Student-cursors-12345'},headers:{Origin:origin}});
 // Exercise the HTTP fallback too; the dedicated realtime test requires WebSocket.
 await tc.addInitScript(()=>{window.WebSocket=undefined;});await sc.addInitScript(()=>{window.WebSocket=undefined;});
 t=await tc.newPage();s=await sc.newPage();const errors=[];for(const p of[t,s])p.on('pageerror',e=>errors.push(e.message));
 await Promise.all([t.goto(origin+`/cabinet/board/${owner.id}`),s.goto(origin+`/cabinet/board/${owner.id}`)]);for(const p of[t,s])await p.locator('.board-paper').first().waitFor();const revision=(await load()).revision;
 const tb=await t.locator('.board-paper').first().boundingBox();await t.mouse.move(tb.x+200,tb.y+200);await s.locator('[data-remote-cursor="teacher"]').waitFor();const transform=await s.locator('[data-remote-cursor="teacher"]').getAttribute('transform');const [x,y]=transform.match(/translate\(([^)]+)\)/)[1].split(' ').map(Number);
 async function sameSheetPosition(){
  await s.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const {b,point}=await s.evaluate(()=>{const paper=document.querySelector('.board-paper').getBoundingClientRect(),cursor=document.querySelector('[data-remote-cursor="teacher"]').getBoundingClientRect();return {b:{x:paper.x,y:paper.y,width:paper.width,height:paper.height},point:{x:cursor.x,y:cursor.y}};});
  const expected={x:b.x+x*b.width/1680,y:b.y+y*b.height/2376};
  assert.ok(Math.abs(point.x-expected.x)<3&&Math.abs(point.y-expected.y)<3,`Cursor stays at the same sheet point across zoom: ${JSON.stringify({b,point,expected,x,y})}`);
 }
 await sameSheetPosition();await s.getByRole('button',{name:'Приблизить лист',exact:true}).tap();await sameSheetPosition();await s.getByRole('button',{name:'Исходный размер листа',exact:true}).tap();
 const sb=await s.locator('.board-paper').first().boundingBox();await s.mouse.move(Math.max(130,sb.x+150),Math.max(220,sb.y+220));await t.locator('[data-remote-cursor="student"]').waitFor();assert.equal((await load()).revision,revision,'Moving cursors never saves notebook revisions');
 await t.mouse.move(10,10);await s.locator('[data-remote-cursor="teacher"]').waitFor({state:'detached'});await t.mouse.move(tb.x+200,tb.y+200);await s.locator('[data-remote-cursor="teacher"]').waitFor();
 // Student receives the entire figure catalogue, including the six 3D windows.
 async function figures(){const summary=s.locator('.board-figures > summary');await summary.scrollIntoViewIfNeeded();await summary.tap();return s.getByRole('group',{name:'Фигуры',exact:true});}
 let menu=await figures();for(const title of ['2D · Плоские фигуры','3D · Объёмные фигуры','3D-визуализация фигур'])assert.equal(await menu.getByRole('group',{name:title,exact:true}).count(),1);
 assert.equal(await menu.getByRole('button').count(),23);await menu.getByRole('button',{name:'Прямоугольник',exact:true}).tap();const b=await s.locator('.board-paper').first().boundingBox();await s.mouse.move(b.x+130,b.y+200);await s.mouse.down();await s.mouse.move(b.x+240,b.y+280,{steps:5});await s.mouse.up();await t.locator('[data-shape-type="rect"]').waitFor();
 await s.getByRole('button',{name:'Ладошка',exact:true}).tap();const rect=s.locator('[data-selection-hit]').first();const before=await s.locator('[data-shape-type="rect"]').getAttribute('x'),r=await rect.boundingBox();await s.mouse.move(r.x+10,r.y+10);await s.mouse.down();await s.mouse.move(r.x+35,r.y+35,{steps:5});await s.mouse.up();await s.waitForFunction(before=>document.querySelector('[data-shape-type="rect"]')?.getAttribute('x')!==before,before);
 for(const name of ['Координатное пространство XYZ','Куб','Параллелепипед','Тетраэдр','Призма','Пирамида']){menu=await figures();await menu.getByRole('button',{name:`${name} — 3D-визуализация`,exact:true}).tap();}
 await t.waitForFunction(()=>document.querySelectorAll('[data-shape-type^="viz-"]').length===6);assert.equal(await s.getByRole('button',{name:'Загрузить файл',exact:true}).count(),0);assert.equal(await s.getByRole('button',{name:'Удалить лист',exact:true}).count(),0);
 await t.mouse.move(tb.x+250,tb.y+250);await s.locator('[data-remote-cursor="teacher"]').waitFor();await s.screenshot({path:`playwright-report/student-figures-cursors-${browser.browserType().name()}.png`});
 await s.evaluate(()=>{window.exportCursorCounts=[];const original=XMLSerializer.prototype.serializeToString;XMLSerializer.prototype.serializeToString=function(node){if(node.nodeName.toLowerCase()==='svg')window.exportCursorCounts.push(node.querySelectorAll('[data-remote-cursor]').length);return original.call(this,node);};});
 const download=s.waitForEvent('download');await s.getByRole('button',{name:'Скачать доску PDF',exact:true}).tap();await download;assert.deepEqual(await s.evaluate(()=>window.exportCursorCounts),[0,0,0],'Cursors are excluded from every PDF page');
 await t.mouse.move(tb.x+255,tb.y+255);await s.locator('[data-remote-cursor="teacher"]').waitFor();
 await t.route('**/api/account?action=presence*',route=>route.abort());await s.locator('[data-remote-cursor="teacher"]').waitFor({state:'detached',timeout:6500});await t.unroute('**/api/account?action=presence*');await t.mouse.move(tb.x+260,tb.y+260);await s.locator('[data-remote-cursor="teacher"]').waitFor();
 await t.getByRole('button',{name:'Другая тема',exact:true}).click();await t.waitForURL(`**?topic=${other.id}`);await s.locator('[data-remote-cursor="teacher"]').waitFor({state:'detached'});await t.mouse.move(tb.x+200,tb.y+200);await new Promise(r=>setTimeout(r,500));assert.equal(await t.locator('[data-remote-cursor="student"]').count(),0,'Cursors stay isolated by topic');
 assert.equal((await load()).notebook.items.length,7);assert.deepEqual(errors,[]);console.log('Presence and pupil figures passed: bidirectional cursors, sheet coordinates at different zoom, hide/TTL/topic isolation, no persistence, full catalogue, drawing/moving and all six 3D windows.');
}catch(error){await t?.screenshot({path:'playwright-report/presence-teacher-failure.png'}).catch(()=>{});await s?.screenshot({path:'playwright-report/presence-student-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();await server.close();for(const suffix of['','-wal','-shm'])await rm(process.env.ACCOUNTS_DB_PATH+suffix,{force:true}).catch(()=>{});}
