import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('/board',process.env.PLAYWRIGHT_URL??'http://127.0.0.1:5173').href);
 await page.evaluate(()=>{
  const types=['cube','cuboid','tetrahedron','prism','pyramid'];
  const items=types.map((type,i)=>({id:type,type,page:0,color:'#212123',size:4,points:[[100+(i%3)*480,300+Math.floor(i/3)*700],[450+(i%3)*480,650+Math.floor(i/3)*700]]}));
  items.push({id:'annotation',type:'pen',page:0,color:'#3058a0',size:4,points:[[110,320],[150,340]]});
  items.push({id:'square',type:'square',page:1,color:'#212123',size:4,points:[[200,400],[600,800]]});
  items.push({id:'third-page-note',type:'line',page:2,color:'#b24838',size:4,points:[[200,400],[600,800]]});
  localStorage.setItem('uliana-whiteboard-v2',JSON.stringify({items,pageCount:3}));
 });
 await page.reload();
 const stored=async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')));
 const item=async id=>(await stored()).items.find(x=>x.id===id);
 const same=async(id,expected)=>page.waitForFunction(([id,expected])=>JSON.stringify(JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id===id))===expected,[id,JSON.stringify(expected)]);
 const paper=page.locator('.board-paper').first();
 await page.getByRole('button',{name:'Ладошка',exact:true}).click();
 async function select(id){
  const hit=page.locator(`[data-select-id="${id}"]`);
  await hit.evaluate(el=>{const r=el.getBoundingClientRect();const controls=document.querySelector('.board-controls').getBoundingClientRect();window.scrollTo(0,scrollY+r.top-controls.height-60);});
  await hit.click();
  return hit;
 }
 async function drag(locator,dx,dy){
  await locator.hover();
  const r=await locator.boundingBox();
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
  await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:12});await page.mouse.up();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 }
 const original=await item('cube'),note=await item('annotation');
 const hit=await select('cube');
 assert.equal(await page.locator('[data-selection-controls]').count(),1);
 await drag(hit,70,50);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id==='cube').points[0][0]>150);
 const moved=await item('cube');
 assert.deepEqual(await item('annotation'),note,'Moving a figure must not disturb independent annotations');
 assert.equal((await stored()).items.length,8,'Hand mode must not draw new strokes');
 await page.getByRole('button',{name:/Отменить/}).click();await same('cube',original);
 await page.getByRole('button',{name:/Повторить/}).click();await same('cube',moved);
 await page.getByRole('button',{name:'Красный',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id==='cube').color==='#b24838');
 for(const id of ['cube','cuboid','tetrahedron','prism','pyramid']) {
  await select(id);
  const shape=paper.locator(`[data-shape-id="${id}"]`);
  const before=await shape.locator('path:not([stroke-dasharray])').getAttribute('d');
  await page.getByRole('button',{name:'Вращать',exact:true}).click();
  await drag(page.locator(`[data-select-id="${id}"]`),55,30);
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id===id).rotation?.some(x=>Math.abs(x)>1),id);
  assert.notEqual(await shape.locator('path:not([stroke-dasharray])').getAttribute('d'),before,`${id} must change view while rotating`);
 }
 const rotated=await item('pyramid');
 await page.getByRole('button',{name:'Сбросить ракурс',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.find(x=>x.id==='pyramid').rotation.every(x=>x===0));
 await page.getByRole('button',{name:/Отменить/}).click();await same('pyramid',rotated);
 await select('square');
 const squareBefore=await item('square');
 const corner=page.locator('[data-select-corner="2"]');
 await drag(corner,45,30);
 const squareAfter=await item('square');
 assert.notDeepEqual(squareAfter.points,squareBefore.points);
 assert.ok(Math.abs(Math.abs(squareAfter.points[1][0]-squareAfter.points[0][0])-Math.abs(squareAfter.points[1][1]-squareAfter.points[0][1]))<.01,'Square resize must preserve equal sides');
 const lastPageNote=await item('third-page-note');
 await page.getByRole('button',{name:'Удалить лист',exact:true}).click();
 await page.getByRole('dialog',{name:'Удалить лист №3?',exact:true}).waitFor();
 assert.equal(await page.locator('.board-paper').count(),3,'Opening confirmation must leave all sheets intact');
 await page.getByRole('button',{name:'Нет',exact:true}).click();
 assert.equal(await page.locator('.board-paper').count(),3,'Declining must keep the sheet');
 await page.getByRole('button',{name:'Удалить лист',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Да, удалить',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.board-paper').length===2);
 assert.deepEqual(await item('square'),squareAfter,'Earlier sheets and their contents must stay intact');
 assert.equal(await item('third-page-note'),undefined,'Only the last sheet contents must be removed');
 await page.getByRole('button',{name:/Отменить/}).click();await same('third-page-note',lastPageNote);
 assert.equal(await page.locator('.board-paper').count(),3);
 await page.getByRole('button',{name:/Повторить/}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.board-paper').length===2);
 await page.reload();
 assert.equal(await page.locator('.board-paper').count(),2,'Sheet deletion must persist after reload');
 assert.deepEqual((await item('pyramid')).rotation,rotated.rotation,'View angle must persist after reload');
 await page.getByRole('button',{name:'Ладошка',exact:true}).click();
 await select('pyramid');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();await(await download).saveAs('.local/rotated-notes.pdf');
 await page.screenshot({path:'playwright-report/selection-desktop.png'});
 await page.setViewportSize({width:320,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'playwright-report/selection-mobile.png'});
 // Keep one remaining sheet and ensure the disabled action prevents an empty notebook.
 await page.getByRole('button',{name:'Удалить лист',exact:true}).click();
 await page.getByRole('dialog',{name:'Удалить лист №2?',exact:true}).getByRole('button',{name:'Да, удалить',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.board-paper').length===1);
 assert.equal(await page.getByRole('button',{name:'Удалить лист',exact:true}).isDisabled(),true);
 await page.reload();assert.equal(await page.locator('.board-paper').count(),1);
 assert.deepEqual(errors,[]);
 console.log('Selection checks passed: hand mode, move, resize, colors, all five rotatable solids, reset view, undo/redo, numbered last-sheet confirmation, cancellation and deletion, persistence, PDF and mobile layout.');
} finally {await browser.close();}
