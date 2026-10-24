import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {createServer} from 'vite';
import {Client} from 'pg';
import {chromium,webkit,request} from 'playwright';

// A separate PostgreSQL schema and API process exercise the actual production
// transport. Never read or modify an existing student's notebook.
if(!process.env.TEST_DATABASE_URL){process.loadEnvFile('backend-go/.env');process.env.TEST_DATABASE_URL=process.env.DATABASE_URL;}
const schema=`integration_realtime_${process.pid}_${Date.now()}`,root=new Client({connectionString:process.env.TEST_DATABASE_URL});await root.connect();await root.query(`CREATE SCHEMA ${schema}`);
const dsn=new URL(process.env.TEST_DATABASE_URL);dsn.searchParams.set('search_path',schema);
await mkdir('tmp',{recursive:true});
let backend,server,browser,t,s;const writes=[],frames=[],errors=[];let connections=0;
try{
const built=spawnSync('./backend-go/scripts/go.sh',['build','-o','../tmp/realtime-api','./cmd/api'],{encoding:'utf8'});if(built.status!==0)throw Error(built.stderr);
const origin='http://127.0.0.1:5197';backend=spawn('./tmp/realtime-api',[],{env:{...process.env,DATABASE_URL:dsn.href,HTTP_ADDR:'127.0.0.1:18087',JWT_SECRET:'realtime-isolated-browser-test-secret-12345',ALLOW_LOCAL_SETUP:'true',COOKIE_SECURE:'false',ALLOWED_ORIGINS:origin},stdio:'ignore'});
 for(let i=0;i<100;i++){if(await fetch('http://127.0.0.1:18087/readyz').then(r=>r.ok).catch(()=>false))break;if(i===99)throw Error('Test Go API failed to start');await new Promise(r=>setTimeout(r,100));}
 process.env.GO_API_URL='http://127.0.0.1:18087';process.env.VITE_GO_BACKEND='true';server=await createServer({server:{host:'127.0.0.1',port:5197,strictPort:true}});await server.listen();browser=await(process.env.BOARD_BROWSER==='webkit'?webkit:chromium).launch();
 const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});assert.equal((await api.post('/api/account?action=setup',{data:{login:'teacher',password:'Teacher-realtime-12345'}})).status(),200);
 const owner=(await(await api.post('/api/account?action=students',{data:{login:'pupil01',password:'Pupil-realtime-12345'}})).json()).student,path=`/api/account?action=board&studentId=${owner.id}`;await api.get(path);
 const notebook={pageCount:12,items:Array.from({length:400},(_,i)=>({id:`existing-${i}`,type:'pen',page:4+i%8,color:'#334a42',size:3,points:Array.from({length:150},(_,j)=>[100+j*5,100+i%20*40+Math.sin(j)*10])}))};
 const bytes=Buffer.byteLength(JSON.stringify(notebook));assert.ok(bytes>1000000);assert.equal((await api.post(path,{data:{studentId:owner.id,notebook,revision:0}})).status(),200);
 const tc=await browser.newContext({storageState:await api.storageState(),viewport:{width:1440,height:1000}}),sc=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await sc.request.post(origin+'/api/account?action=login',{data:{login:'pupil01',password:'Pupil-realtime-12345'},headers:{Origin:origin}});
 t=await tc.newPage();s=await sc.newPage();let teacherSocket;
 for(const page of[t,s]){
  page.on('pageerror',error=>{errors.push(error.message);console.log('Browser error',error.stack);});
  // Slow HTTP uplink penalizes a whole-book upload but hardly a small ink patch.
  await page.route('**/api/account?**',async route=>{const req=route.request(),data=req.postData(),writing=req.method()==='POST'&&req.url().includes('action=board');if(writing)writes.push(JSON.parse(data));await new Promise(r=>setTimeout(r,120+(writing?Buffer.byteLength(data)/64000*1000:0)));await route.continue().catch(()=>{});});
  await page.routeWebSocket('**/api/board/live*',ws=>{connections++;const remote=ws.connectToServer();if(page===t)teacherSocket={remote,ws};remote.onMessage(message=>{frames.push(JSON.parse(String(message)));setTimeout(()=>{try{ws.send(message);}catch{}},40);});ws.onMessage(message=>setTimeout(()=>{try{remote.send(message);}catch{}},40));});
 }
 await Promise.all([t.goto(origin+`/cabinet/board/${owner.id}`),s.goto(origin+`/cabinet/board/${owner.id}`)]);for(const page of[t,s])await page.locator('.board-paper').first().waitFor();await s.waitForFunction(()=>document.querySelectorAll('[data-shape-type="pen"]').length===400);await new Promise(r=>setTimeout(r,300));assert.ok(frames.some(f=>f.type==='ready'),'WebSocket must connect through Vite proxy to real Go API');
 const paper=t.locator('.board-paper').first(),studentPaper=s.locator('.board-paper').first(),box=await paper.boundingBox(),x=Math.max(120,box.x+140),y=Math.max(200,box.y+180);
 await t.getByRole('button',{name:'Ручка',exact:true}).click();await t.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await t.mouse.move(x,y);await t.mouse.down();
 const started=Date.now();await t.mouse.move(x+80,y+40,{steps:5});await studentPaper.locator('[data-shape-type="pen"]').waitFor({timeout:1800});const first=Date.now()-started;assert.ok(first<1800,'Live ink must not wait for a megabyte notebook to upload');
 const before=await studentPaper.locator('[data-shape-type="pen"]').getAttribute('d'),next=Date.now();await t.mouse.move(x+150,y+55,{steps:5});await s.waitForFunction(d=>document.querySelector('.board-paper [data-shape-type="pen"]')?.getAttribute('d')!==d,before,{timeout:1800});const continuation=Date.now()-next;
 await t.mouse.up();assert.ok(writes.length>0&&writes.every(w=>w.patch&&!w.notebook),'Every production write sends only its patch');assert.ok(writes.every(w=>Buffer.byteLength(JSON.stringify(w))<5000),'Large unchanged lesson objects never enter ink uploads');
 await s.locator('[data-remote-cursor="teacher"]').waitFor();await new Promise(r=>setTimeout(r,150));
 const samplesPromise=s.evaluate(()=>new Promise(resolve=>{const samples=[],started=performance.now();const frame=()=>{const text=document.querySelector('[data-remote-cursor="teacher"]')?.getAttribute('transform');samples.push(Number(text?.match(/translate\(([^ ]+)/)?.[1]));if(performance.now()-started<450)requestAnimationFrame(frame);else resolve(samples.filter(Number.isFinite));};requestAnimationFrame(frame);}));
 await t.mouse.move(x+300,y+55);const samples=await samplesPromise,unique=new Set(samples.map(n=>Math.round(n*10)));assert.ok(unique.size>=4,`Cursor must interpolate a single received movement over several frames: ${unique.size}`);
 // A live lesson must outlast ordinary HTTP request/read/write timeouts.
 const steadyConnections=connections;await new Promise(r=>setTimeout(r,31000));assert.equal(connections,steadyConnections,'Live connection survives HTTP timeouts and authenticated heartbeats');
 // Lose the teacher socket, keep writing, then require reconnect and identical
 // saved state on the phone. HTTP fallback remains available throughout.
 const previousConnections=connections;await teacherSocket.remote.close({code:1012,reason:'Test interrupted connection'});await teacherSocket.ws.close({code:1012,reason:'Test interrupted connection'});await t.mouse.move(x,y+90);await t.mouse.down();await t.mouse.move(x+80,y+110,{steps:5});await t.mouse.up();await studentPaper.locator('[data-shape-type="pen"]').nth(1).waitFor({timeout:3000});
 for(let i=0;i<60&&connections===previousConnections;i++)await new Promise(r=>setTimeout(r,100));assert.ok(connections>previousConnections,'Socket reconnects automatically');
 await t.reload();await t.locator('.board-paper').first().waitFor();await t.waitForFunction(()=>document.querySelector('.board-paper')?.querySelectorAll('[data-shape-type="pen"]').length===2);const saved=(await(await api.get(path)).json()).notebook;assert.equal(saved.items.length,402);assert.deepEqual(errors,[]);
 await mkdir('playwright-report',{recursive:true});await s.screenshot({path:`playwright-report/realtime-phone-${browser.browserType().name()}.png`});
 console.log(`Real Go/PostgreSQL, ${Math.round(bytes/1024)} KB / 12 pages, 120 ms HTTP delay + 64 KB/s upload + 40 ms per socket hop: first ink ${first} ms, continuation ${continuation} ms; cursor ${unique.size} interpolated positions. Small patches, reconnect and durable reload passed.`);
}catch(error){await mkdir('playwright-report',{recursive:true});await t?.screenshot({path:'playwright-report/realtime-teacher-failure.png'}).catch(()=>{});await s?.screenshot({path:'playwright-report/realtime-phone-failure.png'}).catch(()=>{});throw error;}finally{await browser?.close();await server?.close();if(backend){backend.kill('SIGTERM');await Promise.race([once(backend,'exit'),new Promise(r=>setTimeout(r,11000))]);}await root.query(`DROP SCHEMA ${schema} CASCADE`);await root.end();await rm('tmp/realtime-api',{force:true});}
