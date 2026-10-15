import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror', error=>errors.push(error.message));
 await page.goto(process.env.PLAYWRIGHT_URL ? new URL('/board',process.env.PLAYWRIGHT_URL).href : 'http://127.0.0.1:5173/board');
 const paper=page.locator('.board-paper').first();
 const point=async(x,y)=>paper.evaluate((el,[x,y])=>{const p=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};},[x,y]);
 const choose=async(name)=>{await page.locator('summary[aria-label="Фигуры"]').click();await page.getByRole('button',{name,exact:true}).click();};
 async function draw(name,x,y,w=260,h=190){
  await choose(name);
  await paper.evaluate((el,y)=>{const r=el.getBoundingClientRect();window.scrollTo(0,scrollY+r.top+r.height*y/el.viewBox.baseVal.height-400);},y);
  const a=await point(x,y),b=await point(x+w,y+h);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();
 }
 await page.locator('summary[aria-label="Фигуры"]').click();
 assert.equal(await page.getByRole('group',{name:'2D · Плоские фигуры',exact:true}).count(),1);
 assert.equal(await page.getByRole('group',{name:'3D · Объёмные фигуры',exact:true}).count(),1);
 await page.locator('summary[aria-label="Фигуры"]').click();
 await draw('Произвольный треугольник',100,130);
 await draw('Равнобедренный треугольник',650,130);
 await draw('Равносторонний треугольник',1100,130);
 const vertices=async type=>paper.locator(`[data-shape-type="${type}"]`).evaluate(el=>[...el.points].map(p=>[p.x,p.y]));
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const equal=await vertices('triangle-equilateral');
 assert.ok(equal.every((p,i)=>Math.abs(distance(p,equal[(i+1)%3])-distance(equal[0],equal[1]))<.01),'Equilateral triangle must have three equal sides');
 const iso=await vertices('triangle');assert.ok(Math.abs(distance(iso[0],iso[1])-distance(iso[0],iso[2]))<.01);
 const arbitrary=await vertices('triangle-scalene');assert.ok(Math.abs(distance(arbitrary[0],arbitrary[1])-distance(arbitrary[0],arbitrary[2]))>1);
 for(const [i,name] of ['Куб','Параллелепипед','Тетраэдр','Призма','Пирамида'].entries()){
  await draw(name,100+(i%3)*500,600+Math.floor(i/3)*400);
 }
 for(const type of ['cube','cuboid','tetrahedron','prism','pyramid']) {
  const object=paper.locator(`[data-shape-type="${type}"]`);
  assert.equal(await object.locator('path[stroke-dasharray]').count(),1,'3D figure needs hidden edges');
  assert.equal(await object.locator('path:not([stroke-dasharray])').count(),1);
 }
 await draw('Оси X и Y',150,1600,700,400);
 await page.waitForFunction(()=>document.querySelectorAll('[data-shape-id]').length===9);
 const axis=paper.locator('[data-shape-type="axes"]');
 assert.equal(await axis.locator('text').allTextContents().then(x=>x.join(',')),'X,Y,0');
 const before=await axis.locator('path').first().getAttribute('d');
 const handle=paper.locator('[data-resize-id][data-handle-index="1"]');
 await paper.evaluate(el=>{const r=el.getBoundingClientRect();window.scrollTo(0,scrollY+r.top+r.height*1900/el.viewBox.baseVal.height-450);});
 await page.waitForFunction(()=>{const h=document.querySelector('[data-resize-id][data-handle-index="1"]');const box=h.getBoundingClientRect();const p=new DOMPoint(Number(h.getAttribute('cx')),Number(h.getAttribute('cy'))).matrixTransform(h.ownerSVGElement.getScreenCTM());return Math.abs(box.x+box.width/2-p.x)<1 && Math.abs(box.y+box.height/2-p.y)<1;});
 await handle.hover();
 await page.mouse.down();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const extended=await point(1000,2150);
 await page.mouse.move(extended.x,extended.y,{steps:10});await page.mouse.up();
 await page.waitForFunction(d=>document.querySelector('[data-shape-type="axes"] path').getAttribute('d')!==d,before);
 await page.waitForFunction(()=>{const item=JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(item=>item.type==='axes');return Math.abs(item.points[1][0]-1000)<1 && Math.abs(item.points[1][1]-2150)<1;});
 const after=await axis.locator('path').first().getAttribute('d');
 assert.notEqual(after,before,'Axes can be resized after insertion');
 assert.equal(await paper.locator('[data-shape-type="axes"]').count(),1,'Resize must not duplicate axes');
 await page.getByRole('button',{name:/Отменить/}).click();
 await page.waitForFunction(d=>document.querySelector('[data-shape-type="axes"] path').getAttribute('d')===d,before);
 await page.getByRole('button',{name:/Повторить/}).click();
 await page.waitForFunction(d=>document.querySelector('[data-shape-type="axes"] path').getAttribute('d')===d,after);
 const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();
 await (await pdfEvent).saveAs('.local/geometry-notes.pdf');
 await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('[data-shape-id]').length===9);
 assert.equal(await axis.locator('path').first().getAttribute('d'),after,'Resized axes must survive reload');
 await paper.screenshot({path:'playwright-report/geometry-sheet.png'});
 await choose('Оси X и Y');
 await paper.evaluate(el=>{const r=el.getBoundingClientRect();window.scrollTo(0,scrollY+r.top+r.height*1700/el.viewBox.baseVal.height-400);});
 await axis.click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-axis-controls] [data-resize-id]').length===2);
 await page.setViewportSize({width:320,height:844});
 await page.locator('summary[aria-label="Фигуры"]').click();
 await page.getByRole('button',{name:'Куб',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'playwright-report/geometry-mobile-menu.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('Geometry checks passed: 2D/3D groups, three triangle geometries, five solids, hidden edges, axes insertion and resize, undo/redo, storage, PDF and mobile menu.');
} finally {await browser.close();}
