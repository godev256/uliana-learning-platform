import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {mergeNotebooks,BoardSync} from '../src/account/board-sync.js';
const cube={id:'cube',type:'viz-cube',page:0,color:'#2f493f',size:4,points:[[80,80],[1520,980]],rotation:[0,0,0],edgePoints:[]};
const base={pageCount:1,items:[cube]},local={...base,items:[{...cube,rotation:[20,30,0]}]},remote={...base,items:[{...cube,edgePoints:[{id:'point-a',edge:[0,1],t:.5,label:'M'}]},{id:'ink',type:'pen',page:0,color:'#212123',size:4,points:[[1,1]]}]};
const merged=mergeNotebooks(base,local,remote);assert.equal(merged.items.length,2);assert.deepEqual(merged.items[0].rotation,[20,30,0]);assert.equal(merged.items[0].edgePoints.length,1);assert.equal(mergeNotebooks(base,{pageCount:1,items:[]},remote).items.some(i=>i.id==='cube'),false);
let serverBook=remote,revision=1,conflicted=false;const session=new BoardSync({remote:{notebook:base,revision:0},request:async body=>{if(!body)return {notebook:serverBook,revision};if(body.revision!==revision){conflicted=true;throw Object.assign(new Error('conflict'),{status:409});}serverBook=body.notebook;return {revision:++revision};}});session.change(local);assert.equal(await session.flush(),true);assert.ok(conflicted);assert.equal(serverBook.items.length,2);assert.equal(serverBook.items[0].edgePoints.length,1);session.stop();
process.env.ACCOUNTS_DB_PATH=`.local/live-sync-check-${process.pid}.sqlite`;
const server=await createServer({server:{host:'127.0.0.1',port:5186,strictPort:true}});await server.listen();const origin='http://127.0.0.1:5186';
try{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{
 const tc=await browser.newContext({viewport:{width:1440,height:1000}}),sc=await browser.newContext({viewport:{width:1440,height:1000}}),post=(ctx,action,data)=>ctx.request.post(`${origin}/api/account?action=${action}`,{data,headers:{Origin:origin}});
 if(engine===chromium)assert.equal((await post(tc,'setup',{login:'teacher',password:'Teacher-live-12345'})).status(),200);else await post(tc,'login',{login:'teacher',password:'Teacher-live-12345'});
 const login=`pupil-${engine.name()}`,response=await post(tc,'students',{login,password:'Student-live-12345'}),id=(await response.json()).student.id;await post(sc,'login',{login,password:'Student-live-12345'});
 const t=await tc.newPage(),s=await sc.newPage(),errors=[];for(const p of[t,s])p.on('pageerror',e=>errors.push(e.message));
 await Promise.all([t.goto(`${origin}/cabinet/board/${id}`),s.goto(`${origin}/cabinet/board/${id}`)]);await Promise.all([t.locator('.board-paper').first().waitFor(),s.locator('.board-paper').first().waitFor()]);
 await t.locator('summary[aria-label="Фигуры"]').click();await t.getByRole('button',{name:'Куб — 3D-визуализация',exact:true}).click();await s.locator('[data-shape-type="viz-cube"]').waitFor();
 assert.equal(await s.locator('summary[aria-label="Фигуры"]').count(),1);assert.equal(await s.getByRole('button',{name:'Загрузить файл',exact:true}).count(),0);
 const card=p=>p.locator('[data-shape-type="viz-cube"]'),shape=p=>card(p).locator('polygon').first().getAttribute('points');
 async function rotate(p,hold=false){await card(p).getByRole('button',{name:'Вращать',exact:true}).click();await p.locator('.board-sheet-viewport').evaluate(n=>n.scrollTop=0);const b=await card(p).locator('[data-viz-body]').boundingBox(),x=b.x+b.width*.5,y=Math.min(b.y+b.height*.5,750);await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+65,y+30,{steps:8});if(!hold)await p.mouse.up();}
 const initial=await shape(s);await rotate(t,true);await s.waitForFunction(before=>document.querySelector('[data-shape-type="viz-cube"] polygon')?.getAttribute('points')!==before,initial);assert.equal(await s.locator('[data-shape-type="viz-cube"]').count(),1);await t.mouse.up();
 await s.waitForFunction(()=>document.querySelector('.board-header p')?.textContent.includes('Доска сохранена'));
 const before=await shape(t);await rotate(s);await t.waitForFunction(before=>document.querySelector('[data-shape-type="viz-cube"] polygon')?.getAttribute('points')!==before,before);
 await card(s).getByRole('button',{name:'Сбросить ракурс',exact:true}).click();await t.waitForFunction(initial=>document.querySelector('[data-shape-type="viz-cube"] polygon')?.getAttribute('points')===initial,initial);
 // A student can use the construction controls in the teacher's shared window.
 await card(s).getByRole('button',{name:'Точка на ребре',exact:true}).click();
 const point=await card(s).locator('[data-viz-edge]').first().evaluate(node=>{const pt=node.getPointAtLength(node.getTotalLength()/2);return new DOMPoint(pt.x,pt.y).matrixTransform(node.getScreenCTM()).toJSON();});await s.mouse.click(point.x,point.y);await t.locator('[data-edge-point-id]').waitFor();assert.equal(await s.locator('[data-edge-point-id]').count(),1);
 for(const [action,indices,target] of [['Отрезок по точкам',[0,1],'[data-space-segment]'],['Плоскость через 3 точки',[0,1,2],'[data-plane-section]']]){
  await card(s).getByRole('button',{name:action,exact:true}).click();
  for(const index of indices){const pt=await card(s).locator(`[data-vertex-index="${index}"] circle`).evaluate(node=>new DOMPoint(Number(node.getAttribute('cx')),Number(node.getAttribute('cy'))).matrixTransform(node.getScreenCTM()).toJSON());await s.mouse.click(pt.x,pt.y);}
  await t.locator(target).waitFor();
 }
 // A temporary network failure keeps the local work and sends it after reconnecting.
 await s.route('**/api/account?**',route=>route.request().method()==='POST'?route.abort('failed'):route.continue());
 const beforeOffline=await shape(t);await rotate(s);await s.getByText(/Связь прервана/).waitFor();
 await s.unroute('**/api/account?**');await t.waitForFunction(before=>document.querySelector('[data-shape-type="viz-cube"] polygon')?.getAttribute('points')!==before,beforeOffline);
 await Promise.all([t.reload(),s.reload()]);await Promise.all([t.locator('[data-edge-point-id]').waitFor(),s.locator('[data-edge-point-id]').waitFor()]);
 await s.screenshot({path:`playwright-report/live-3d-student-${engine.name()}.png`});assert.deepEqual(errors,[]);console.log(`${engine.name()}: teacher insertion, live rotation before release, student rotation/reset/point/segment/plane tools, reconnect, bidirectional persistence and restricted menus passed.`);await tc.close();await sc.close();
}finally{await browser.close();}}}finally{await server.close();for(const suffix of['','-wal','-shm'])await rm(process.env.ACCOUNTS_DB_PATH+suffix,{force:true}).catch(()=>{});}
