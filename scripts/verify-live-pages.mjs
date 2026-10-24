import assert from 'node:assert/strict';
import {mkdir,rm} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,webkit,request} from 'playwright';
import sharp from 'sharp';
import {BoardSync,mergeNotebooks} from '../src/account/board-sync.js';
// A read can finish while a save is in flight. Its newer revision must survive
// the save response, while unchanged page objects retain their identity.
const fixed={id:'fixed',page:0,type:'rect',points:[[1,1],[2,2]]},initial={pageCount:1,items:[fixed]},written={...initial,items:[fixed,{id:'local',page:0,type:'pen',points:[[1,1]]}]},newer={...written,items:[...written.items,{id:'remote',page:0,type:'pen',points:[[2,2]]}]};
assert.equal(mergeNotebooks(initial,initial,newer).items[0],fixed);
let finishRead,finishSave,received;
const sync=new BoardSync({remote:{notebook:initial,revision:0},request:(body)=>new Promise(resolve=>{if(body)finishSave=resolve;else finishRead=resolve;}),onRemote:book=>{received=book;}});
sync.change(written);const saving=sync.flush(),reading=sync.refresh(true);finishRead({notebook:newer,revision:2});finishSave({revision:1});await Promise.all([saving,reading]);assert.equal(sync.revision,2);assert.equal(received.items.length,3);sync.stop();

process.env.ACCOUNTS_DB_PATH=`.local/live-pages-${process.pid}.sqlite`;
const server=await createServer({server:{host:'127.0.0.1',port:5195,strictPort:true}});await server.listen();
const origin='http://127.0.0.1:5195',browser=await(process.env.BOARD_BROWSER==='webkit'?webkit:chromium).launch();await mkdir('playwright-report',{recursive:true});let t,s;
try{
 const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 assert.equal((await api.post('/api/account?action=setup',{data:{login:'teacher',password:'Teacher-live-12345'}})).status(),200);
 const owner=(await(await api.post('/api/account?action=students',{data:{login:'pupil01',password:'Pupil-live-12345'}})).json()).student;
 const path=`/api/account?action=board&studentId=${owner.id}`;await api.get(path);
 const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850"><rect width="600" height="850" fill="white"/><text x="50" y="80" font-size="30">PDF worksheet</text></svg>')).png().toBuffer();
 for(let i=0;i<12;i++)assert.equal((await api.post('/api/account?action=asset',{data:{studentId:owner.id,assetId:`page-${i}`,part:0,total:1,mime:'image/png',data:png.toString('base64')}})).status(),200);
 const notebook={pageCount:12,items:Array.from({length:12},(_,page)=>({id:`background-${page}`,type:'image',background:true,page,color:'#212123',size:4,assetId:`page-${page}`,points:[[0,0],[1600,2266]]}))};
 assert.equal((await api.post(path,{data:{notebook,revision:0}})).status(),200);
 const tc=await browser.newContext({storageState:await api.storageState(),viewport:{width:1440,height:1000}});
 const sc=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await sc.request.post(origin+'/api/account?action=login',{data:{login:'pupil01',password:'Pupil-live-12345'},headers:{Origin:origin}});
 t=await tc.newPage();s=await sc.newPage();const errors=[];let assetReads=0;
 for(const page of [t,s]){page.on('pageerror',error=>errors.push(error.message));await page.route('**/api/account?**',async route=>{if(route.request().method()==='GET'&&route.request().url().includes('action=asset'))assetReads++;await new Promise(r=>setTimeout(r,60));await route.continue();});}
 await Promise.all([t.goto(origin+`/cabinet/board/${owner.id}`),s.goto(origin+`/cabinet/board/${owner.id}`)]);
 for(const page of [t,s]){await page.locator('.board-paper').first().waitFor();await page.locator('.board-preload-overlay').waitFor({state:'detached'});await page.waitForFunction(()=>[...document.querySelectorAll('image[data-board-asset]')].filter(n=>n.getAttribute('href')?.startsWith('blob:')).length===12);}
 assert.equal(assetReads,24,'All pages load once, including pages far below the viewport');
 const hrefs=await s.locator('image[data-board-asset]').evaluateAll(nodes=>nodes.map(n=>{n.dataset.identity='retained';return n.getAttribute('href');}));
 for(const page of [t,s]){await page.route('**/api/account?action=asset*',route=>route.abort());await page.locator('.board-sheet-viewport').evaluate(async node=>{for(let i=0;i<12;i++){node.scrollTop=i*2376;await new Promise(r=>requestAnimationFrame(r));}node.scrollTop=0;});}
 assert.equal(assetReads,24,'Scrolling does not fetch pages again');assert.deepEqual(await s.locator('image[data-board-asset]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),hrefs);
 async function pen(page){await page.getByRole('button',{name:'Ручка',exact:true}).click();await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.locator('.board-sheet-viewport').evaluate(n=>n.scrollTop=0);const b=await page.locator('.board-paper').first().boundingBox();const x=Math.max(95,b.x+125),y=Math.max(180,b.y+170);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,y+35,{steps:8});return [x,y];}
 let started=Date.now();const [x,y]=await pen(t);await s.locator('[data-shape-type="pen"]').waitFor({timeout:1500});let latency=Date.now()-started;assert.ok(latency<1500,`Live stroke received before release: ${latency} ms`);
 const firstPath=await s.locator('[data-shape-type="pen"]').getAttribute('d');started=Date.now();await t.mouse.move(x+170,y+55,{steps:8});await s.waitForFunction(before=>document.querySelector('[data-shape-type="pen"]')?.getAttribute('d')!==before,firstPath,{timeout:1500});console.log(`Live updates with 60 ms request latency: first stroke ${latency} ms, continuation ${Date.now()-started} ms, both before pointer release`);
 // Pupil starts writing while teacher still holds the pen. Both commits must survive.
 await pen(s);await s.mouse.up();await new Promise(r=>setTimeout(r,400));await t.mouse.move(x+220,y+65,{steps:8});await new Promise(r=>setTimeout(r,250));await t.mouse.up();
 for(const page of [t,s])await page.waitForFunction(()=>document.querySelectorAll('[data-shape-type="pen"]').length===2);
 await t.getByRole('button',{name:'Отменить',exact:true}).click();await s.waitForFunction(()=>document.querySelectorAll('[data-shape-type="pen"]').length===1);
 await t.getByRole('button',{name:'Повторить',exact:true}).click();await s.waitForFunction(()=>document.querySelectorAll('[data-shape-type="pen"]').length===2);
 await pen(t);await s.waitForFunction(()=>document.querySelectorAll('[data-shape-type="pen"]').length===3);await t.locator('.board-paper').first().dispatchEvent('pointercancel',{pointerId:1});await t.mouse.up();await s.waitForFunction(()=>document.querySelectorAll('[data-shape-type="pen"]').length===2);
 assert.deepEqual(await s.locator('image[data-board-asset]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),hrefs);assert.equal(await s.locator('image[data-identity="retained"]').count(),12,'Remote ink never remounts page images');
 await s.screenshot({path:`playwright-report/live-pages-${browser.browserType().name()}.png`});
 await Promise.all([t.reload(),s.reload()]);for(const page of [t,s]){await page.locator('.board-preload-overlay').waitFor({state:'detached'});await page.waitForFunction(()=>document.querySelectorAll('[data-shape-type="pen"]').length===2);}
 // A failed page download is visible and can be retried without a page reload.
 const retryContext=await browser.newContext({storageState:await api.storageState(),viewport:{width:1440,height:1000}}),retry=await retryContext.newPage();let failed=false;
 await retry.route('**/api/account?action=asset*',route=>{if(!failed&&new URL(route.request().url()).searchParams.get('assetId')==='page-0'){failed=true;return route.fulfill({status:503,json:{error:'Test interrupted download'}});}return route.continue();});
 await retry.goto(origin+`/cabinet/board/${owner.id}`);await retry.getByRole('button',{name:'Повторить загрузку',exact:true}).waitFor();await retry.locator('.board-preload-overlay').waitFor({state:'detached'});await retry.getByRole('button',{name:'Повторить загрузку',exact:true}).click();await retry.waitForFunction(()=>[...document.querySelectorAll('image[data-board-asset]')].filter(n=>n.getAttribute('href')?.startsWith('blob:')).length===12);await retry.locator('.board-image-load-error').waitFor({state:'detached'});await retryContext.close();
 const saved=(await(await api.get(path)).json()).notebook;assert.equal(saved.items.length,14);assert.deepEqual(errors,[]);console.log('12 preloaded pages: stable decoded images, no refetch while scrolling, teacher/pupil live ink, overlapping strokes, undo/redo, mobile layout and server persistence passed');
}catch(error){await t?.screenshot({path:'playwright-report/live-pages-teacher-failure.png'}).catch(()=>{});await s?.screenshot({path:'playwright-report/live-pages-pupil-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();await server.close();for(const suffix of['','-wal','-shm'])await rm(process.env.ACCOUNTS_DB_PATH+suffix,{force:true}).catch(()=>{});}
