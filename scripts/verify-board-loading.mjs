setTimeout(()=>{console.error('Test deadline exceeded');process.exit(1);},90000).unref();
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
process.env.GO_API_URL='http://127.0.0.1:1';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let release,gate,fail=false;const hold=()=>{gate=new Promise(resolve=>{release=resolve;setTimeout(resolve,12000);});};hold();
  await page.route('**/api/account?**',async route=>{
   const url=new URL(route.request().url()),action=url.searchParams.get('action');
   if(action==='board'&&route.request().method()==='GET')await gate;
   if(action==='board'&&route.request().method()==='GET'&&fail)return route.fulfill({status:500,json:{error:'Не удалось открыть доску'}});
   await route.fulfill({json:action==='session'?{user:{id:'loading-preview',login:'preview',role:'student'}}:action==='topics'?{topics:[{id:'main',title:'Урок',kind:'board'},{id:'algebra',title:'Алгебра',kind:'board'}]}:action==='board'?{notebook:{pageCount:1,items:[]},revision:0,student:{login:'preview'},topic:{id:url.searchParams.get('topicId')||'main',kind:'board'}}:{}});
  });
  await page.goto(origin+'/cabinet/board/loading-preview',{waitUntil:'domcontentloaded'});
  const loader=page.locator('.board-loading-screen');await loader.waitFor();await page.waitForFunction(()=>document.fonts.status==='loaded');
  assert.equal(await loader.getAttribute('role'),'status');
  const orbit=page.locator('.board-loading-orbit');const first=await orbit.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(150);assert.notEqual(await orbit.evaluate(el=>getComputedStyle(el).transform),first,'Ring rotates smoothly');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No mobile overflow');
  await page.screenshot({path:`.local/design-review/board-loader-${engine.name()}-${width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await orbit.evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('.board-loading-screen'));while(!release)await page.waitForTimeout(20);release();await loader.waitFor({state:'detached'});await page.locator('.board-paper').first().waitFor();
  if(width===390)await page.locator('.board-topic-rail summary').click();hold();await page.getByRole('button',{name:'Алгебра',exact:true}).click();await loader.waitFor();while(!release)await page.waitForTimeout(20);release();await loader.waitFor({state:'detached'});await page.locator('.board-paper').first().waitFor();assert.ok(page.url().includes('topic=algebra'));
  // A failed request exits the loader and leaves the error readable.
  if(width===390)await page.locator('.board-topic-rail summary').click();hold();fail=true;await page.getByRole('button',{name:'Урок',exact:true}).click();await loader.waitFor();while(!release)await page.waitForTimeout(20);release();await loader.waitFor({state:'detached'});await page.getByText('Не удалось открыть доску',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(`${engine.name()} ${width}: initial loading, animation, reduced motion, switching and error exit passed`);await context.close();
 }}catch(error){console.error(error);throw error;}finally{await browser.close();}
}}finally{await server.close();}
