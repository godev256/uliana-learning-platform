import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const origin='http://192.0.2.1:5173';
const profiles=[['phone',390,844],['small-phone',320,740],['tablet-portrait',768,1024],['tablet-air',820,1180],['tablet-landscape',1024,768],['tablet-pro-landscape',1366,1024]];
const [engineFilter,profileFilter]=process.argv.slice(2);
for(const engine of [chromium,webkit].filter(engine=>!engineFilter||engine.name()===engineFilter)) {
 const browser=await engine.launch();
 try {
  for(const [name,width,height] of profiles.filter(([name])=>!profileFilter||name===profileFilter)) {
   const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   // Keep an actual insecure LAN origin while serving the local app; localhost masks this bug.
   await page.route(`${origin}/**`,async route=>{const response=await route.fetch({url:route.request().url().replace(origin,'http://127.0.0.1:5173')});await route.fulfill({response});});
   await page.goto(`${origin}/board`);
   assert.equal(await page.evaluate(()=>isSecureContext),false);
   assert.equal(await page.evaluate(()=>typeof crypto.randomUUID),'undefined');
   assert.equal(await page.getByRole('button',{name:'Точка по координатам',exact:true}).count(),0);
   const viewport=page.locator('.board-workspace'),paper=page.locator('.board-paper').first(),stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2'))),frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const rail=await page.locator('.board-controls').boundingBox(),view=await viewport.boundingBox();
   assert.ok(rail.x+rail.width<=view.x+1,`${name}: side rail must leave sheet usable`);
   assert.ok(view.height>height*.7);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   let send,stylus;
   if(engine===chromium){const cdp=await page.context().newCDPSession(page);send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id}))});stylus=(type,x,y)=>cdp.send('Input.dispatchMouseEvent',{type,x,y,pointerType:'pen',button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,force:type==='mouseReleased'?0:.6});}
   async function draw(x,y) {
    const before=(await stored()).items.filter(item=>item.type==='pen').length;
    if(send){await send('touchStart',[[x,y,1]]);for(let i=1;i<=8;i++)await send('touchMove',[[x+i*8,y+i*3,1]]);await send('touchEnd',[]);}
    else {await page.touchscreen.tap(x,y);await page.mouse.move(x+10,y+10);await page.mouse.down();await page.mouse.move(x+64,y+24,{steps:8});await page.mouse.up();}
    await frame();const strokes=(await stored()).items.filter(item=>item.type==='pen');
    assert.equal(strokes.length,before+(send?1:2),`${engine.name()} ${name}: writing must save`);
    assert.ok(strokes.at(-1).points.length>1,'Movement must produce a continuous stroke');
   }
   await draw(view.x+40,view.y+90);
   if(stylus){const count=(await stored()).items.length;await stylus('mousePressed',view.x+45,view.y+125);for(let i=1;i<=8;i++)await stylus('mouseMoved',view.x+45+i*8,view.y+125+i*3);await stylus('mouseReleased',view.x+109,view.y+149);await frame();assert.equal((await stored()).items.length,count+1,'A pen pointer must draw continuously on HTTP');assert.ok((await stored()).items.at(-1).points.length>1);}

   await page.getByRole('button',{name:'Приблизить лист',exact:true}).click();await page.getByRole('button',{name:'Приблизить лист',exact:true}).click();await frame();
   assert.equal(await page.locator('.board-zoom-reset').textContent(),'150%');
   await draw(view.x+50,view.y+150);
   await page.getByRole('button',{name:'Ладошка',exact:true}).click();const before=await viewport.evaluate(el=>el.scrollTop);
   if(send){await send('touchStart',[[view.x+view.width*.7,view.y+200,1]]);await send('touchMove',[[view.x+view.width*.7-40,view.y+100,1]]);await send('touchEnd',[]);}
   else {await page.mouse.move(view.x+view.width*.7,view.y+200);await page.mouse.down();await page.mouse.move(view.x+view.width*.7-40,view.y+100,{steps:8});await page.mouse.up();}
   assert.ok(await viewport.evaluate(el=>el.scrollTop)>before+50,'Hand must pan the sheet on a tablet too');
   await page.getByRole('button',{name:'Ручка',exact:true}).click();
   if(send){
    const before=(await stored()).items.length,cx=view.x+view.width/2,cy=view.y+170;
    await send('touchStart',[[cx-30,cy,1]]);await send('touchStart',[[cx-30,cy,1],[cx+30,cy,2]]);await send('touchMove',[[cx-65,cy,1],[cx+65,cy,2]]);await send('touchEnd',[]);await frame();
    assert.equal((await stored()).items.length,before,'Pinch cannot leave stray ink');
    assert.ok(parseInt(await page.locator('.board-zoom-reset').textContent())>150,'Pinch zoom must work on tablet');
    await draw(view.x+45,view.y+120);
   }
   await page.getByRole('button',{name:'Лист по ширине экрана',exact:true}).click();await viewport.evaluate(el=>{el.scrollTop=0;el.scrollLeft=0;});
   await page.locator('summary[aria-label="Фигуры"]').click();await page.getByRole('button',{name:'Куб — 3D-визуализация',exact:true}).click();await frame();assert.equal(await page.locator('[data-shape-type="viz-cube"]').count(),1,'3D insertion must work without randomUUID');
   await page.getByRole('button',{name:'Ручка',exact:true}).click();await viewport.evaluate(el=>{el.scrollTop=0;el.scrollLeft=0;});
   const body=await page.locator('[data-viz-body]').boundingBox();await draw(Math.max(view.x+25,body.x+20),body.y+25);
   const saved=await stored();assert.equal(new Set(saved.items.map(item=>item.id)).size,saved.items.length);await page.reload();assert.deepEqual(await stored(),saved);
   if(name==='tablet-portrait'||name==='tablet-landscape'||name==='phone')await page.screenshot({path:`playwright-report/${engine.name()}-${name}-lan.png`});
   assert.deepEqual(errors,[],`${engine.name()} ${name}: no runtime errors over HTTP`);
   console.log(`${engine.name()} ${name} ${width}×${height}: HTTP writing, touch tap, continuous ink, zoom, hand pan, 3D insertion/overdraw, persistence passed${send?', pinch recovery and pen input passed':''}.`);
   await page.close();
  }
 }finally{await browser.close();}
}
