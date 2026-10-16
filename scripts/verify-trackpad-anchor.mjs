import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:5187,strictPort:true}});await server.listen();
try{for(const engine of[chromium,webkit]){
 const browser=await engine.launch();try{for(const width of[1440,390,1024]){
  const page=await browser.newPage({viewport:{width,height:950},hasTouch:width<1100,isMobile:width<1100});await page.goto('http://127.0.0.1:5187/board');await page.evaluate(()=>document.fonts.ready);
  const paper=page.locator('.board-paper').first(),viewport=page.locator('.board-sheet-viewport'),pen=page.getByRole('button',{name:'Ручка',exact:true}),reset=page.locator('.board-zoom-reset'),frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const before=await paper.boundingBox(),toolWidth=(await pen.boundingBox()).width,topicWidth=(await page.locator('.board-topic-rail').boundingBox()).width,view=await viewport.boundingBox(),client=[view.x+view.width*.65,view.y+180],initialZoom=Number((await reset.textContent()).replace('%',''))/100;
  const world=await paper.evaluate((node,p)=>{const point=new DOMPoint(...p).matrixTransform(node.getScreenCTM().inverse());return [point.x,point.y];},client);
  if(engine===chromium&&width===1440){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:client[0],y:client[1],deltaX:0,deltaY:-Math.log(2)/.01,modifiers:2});}
  else await viewport.dispatchEvent('wheel',{ctrlKey:true,deltaY:-Math.log(2)/.01,clientX:client[0],clientY:client[1]});
  await frame();assert.ok(Math.abs((await paper.boundingBox()).width/before.width-2)<.02);assert.ok(Math.abs((await pen.boundingBox()).width-toolWidth)<1);assert.ok(Math.abs((await page.locator('.board-topic-rail').boundingBox()).width-topicWidth)<1);
  const projected=await paper.evaluate((node,p)=>{const point=new DOMPoint(...p).matrixTransform(node.getScreenCTM());return [point.x,point.y];},world);assert.ok(Math.abs(projected[0]-client[0])<2&&Math.abs(projected[1]-client[1])<2,`Anchor stays under the cursor ${JSON.stringify({projected,client,before,after:await paper.boundingBox(),view})}`);assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  await reset.click();await frame();await viewport.evaluate(node=>{node.scrollLeft=0;node.scrollTop=0;});
  await viewport.evaluate((node,p)=>{for(const[type,scale]of[['gesturestart',1],['gesturechange',1.6],['gestureend',1.6]]){const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{scale:{value:scale},clientX:{value:p[0]},clientY:{value:p[1]}});node.dispatchEvent(event);}},client);await frame();assert.ok(Math.abs((await paper.boundingBox()).width/before.width-1.6)<.02);
  await reset.click();await frame();await viewport.evaluate(node=>{node.scrollLeft=0;node.scrollTop=0;});
  if(engine===chromium&&width<1100){const cdp=await page.context().newCDPSession(page),r=await paper.boundingBox(),cx=r.x+r.width*.5,cy=Math.max(view.y+70,r.y+90);for(const[type,touchPoints]of[['touchStart',[{x:cx-25,y:cy,id:1}]],['touchStart',[{x:cx-25,y:cy,id:1},{x:cx+25,y:cy,id:2}]],['touchMove',[{x:cx-50,y:cy,id:1},{x:cx+50,y:cy,id:2}]],['touchEnd',[]]])await cdp.send('Input.dispatchTouchEvent',{type,touchPoints});await frame();assert.ok((await paper.boundingBox()).width>before.width*1.8);assert.equal(await page.locator('[data-shape-type="pen"]').count(),0);}
  else{await page.getByRole('button',{name:'Приблизить лист',exact:true}).click();await frame();}
  const bounds=await paper.boundingBox(),x=Math.max(view.x+40,bounds.x+40),y=Math.max(view.y+70,bounds.y+100);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y+25,{steps:5});await page.mouse.up();const end=await page.locator('[data-shape-type="pen"]').last().evaluate(node=>{const p=node.getPointAtLength(node.getTotalLength());return new DOMPoint(p.x,p.y).matrixTransform(node.getScreenCTM()).toJSON();});assert.ok(Math.hypot(end.x-x-35,end.y-y-25)<2);
  await page.screenshot({path:`playwright-report/trackpad-anchor-${engine.name()}-${width}.png`});console.log(`${engine.name()} ${width}: sheet pinch (${initialZoom*100}% initial), fixed tools/topics, cursor anchor, Safari gesture path and ink passed.`);await page.close();
 }}finally{await browser.close();}
}}finally{await server.close();}
