import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('/board',process.env.PLAYWRIGHT_URL??'http://127.0.0.1:5173').href);
 assert.deepEqual(await page.locator('.board-tools > button').allTextContents(),['Ладошка','✎Ручка','⌫Ластик','╱Линия']);
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')));
 const types=[['cube','Куб'],['cuboid','Параллелепипед'],['tetrahedron','Тетраэдр'],['prism','Призма'],['pyramid','Пирамида']];
 for (const [type,label] of types) {
  await page.getByLabel('Фигуры',{exact:true}).locator('visible=true').first().click();
  await page.getByRole('button',{name:`${label} — 3D-визуализация`,exact:true}).click();
  const card=page.locator(`[data-shape-type="viz-${type}"]`);
  await card.waitFor();
  assert.ok(await card.locator('polygon').count()>0,'Models need filled faces');
  if (type==='cube') {
   const edges=await card.locator('[data-viz-body] path:not([stroke-dasharray])').getAttribute('d');
   const segments=[...edges.matchAll(/M([\d.e+-]+),([\d.e+-]+) L([\d.e+-]+),([\d.e+-]+)/g)];
   assert.equal(segments.filter(([,x1,,x2])=>Math.abs(Number(x1)-Number(x2))<1e-6).length,3,'The initial cube view must have three upright visible edges');
   await card.screenshot({path:'playwright-report/upright-cube.png'});
  }
  const faceBefore=await card.locator('polygon').first().getAttribute('points');
  const body=card.locator('[data-viz-body]');
  await body.evaluate(el=>{const r=el.getBoundingClientRect();const top=document.querySelector('.board-controls').getBoundingClientRect().bottom;window.scrollBy(0,r.top-top-60);});
  await body.hover();
  const r=await body.boundingBox();
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
  await page.mouse.move(r.x+r.width/2+70,r.y+r.height/2+35,{steps:10});await page.mouse.up();
  await page.waitForFunction(type=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.type===type)?.rotation.some(x=>Math.abs(x)>1),`viz-${type}`);
  assert.notEqual(await card.locator('polygon').first().getAttribute('points'),faceBefore);
 }
 const original=(await stored()).items.at(-1);
 const header=page.locator(`[data-shape-id="${original.id}"] [data-viz-header]`);
 await header.hover();let r=await header.boundingBox();
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+10,r.y+r.height/2+45,{steps:8});await page.mouse.up();
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id===id).points[0][1]>100,original.id);
 const moved=(await stored()).items.at(-1);assert.notDeepEqual(moved.points,original.points);assert.deepEqual(moved.rotation,original.rotation);
 await page.getByRole('button',{name:/Отменить/}).click();
 await page.waitForFunction(item=>JSON.stringify(JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.at(-1))===JSON.stringify(item),original);
 await page.getByRole('button',{name:/Повторить/}).click();
 await page.getByRole('button',{name:'Ладошка',exact:true}).click();
 const corner=page.locator('[data-select-corner="2"]');await corner.hover();r=await corner.boundingBox();
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2-90,r.y+r.height/2-60,{steps:8});await page.mouse.up();
 await page.waitForFunction(id=>{const x=JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id===id);return x.points[1][0]-x.points[0][0]<1440},original.id);
 const saved=await stored();assert.equal(saved.items.length,5,'Manipulating models must not add pen strokes');
 await page.reload();assert.deepEqual(await stored(),saved);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();await(await download).saveAs('.local/visualization-notes.pdf');
 await page.locator('.board-paper').first().scrollIntoViewIfNeeded();await page.screenshot({path:'playwright-report/visualization-desktop.png'});
 // Keep one model visible for a readable mobile preview and exercise touch rotation.
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await mobile.goto('http://127.0.0.1:5173/board');
 await mobile.evaluate(item=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({items:[{...item,points:[[80,100],[1520,1200]]}],pageCount:1})),saved.items.at(-1));await mobile.reload();
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const body=mobile.locator('[data-viz-body]');const box=await body.boundingBox();
 const x=box.x+box.width/2,y=box.y+box.height/2;
 const cdp=await mobile.context().newCDPSession(mobile);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+45,y:y+20}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await mobile.waitForFunction(before=>JSON.stringify(JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items[0].rotation)!==JSON.stringify(before),saved.items.at(-1).rotation);
 await mobile.screenshot({path:'playwright-report/visualization-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('3D visualization checks passed: five shaded models, immediate insertion, rotation, move, resize, undo/redo, persistence, PDF and mobile touch.');
} finally {await browser.close();}
