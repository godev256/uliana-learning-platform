import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:5182,strictPort:true}});await server.listen();
try { for (const engine of [chromium,webkit]) {
 const browser=await engine.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5182/board');
  const paper=page.locator('.board-paper').first();
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')));
  async function draw(points){
   const screen=await paper.evaluate((svg,points)=>points.map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return [p.x,p.y];}),points);
   await page.mouse.move(...screen[0]);await page.mouse.down();for(const pt of screen.slice(1))await page.mouse.move(...pt,{steps:3});await page.mouse.up();
  }
  await draw([[200,200],[300,250],[400,200]]);
  const original=(await stored()).items[0];
  await page.getByRole('button',{name:'Выделитель',exact:true}).click();
  const palette=page.getByRole('group',{name:'Цвет выделителя',exact:true});assert.equal(await palette.getByRole('button').count(),5);
  await palette.getByRole('button',{name:'Розовый',exact:true}).click();
  await draw([[200,200],[280,250],[400,200]]);
  let marker=(await stored()).items.at(-1);assert.equal(marker.type,'highlighter');assert.equal(marker.color,'#ed94b6');assert.equal(marker.size,36);assert.ok(marker.points.length>2);
  assert.equal(await paper.locator('[data-shape-type="highlighter"]').getAttribute('opacity'),'0.3');
  await page.getByRole('button',{name:'Отменить',exact:true}).click();assert.equal((await stored()).items.length,1);
  await page.getByRole('button',{name:'Повторить',exact:true}).click();assert.equal((await stored()).items.length,2);
  await page.getByRole('button',{name:'Ручка',exact:true}).click();await draw([[500,200],[550,230]]);const pen=(await stored()).items.at(-1);assert.equal(pen.color,original.color);assert.equal(pen.size,original.size);
  await page.reload();assert.equal(await paper.locator('[data-shape-type="highlighter"]').count(),1);
  assert.equal((await stored()).items.find(i=>i.type==='highlighter').points.length,marker.points.length);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();const pdf=await download;assert.match(pdf.suggestedFilename(),/\.pdf$/);assert.equal(await pdf.failure(),null);
  await page.getByRole('button',{name:'Ластик',exact:true}).click();await paper.locator('[data-shape-type="highlighter"]').click({position:{x:15,y:15}});assert.equal(await paper.locator('[data-shape-type="highlighter"]').count(),0);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Выделитель',exact:true}).click();await palette.getByRole('button',{name:'Голубой',exact:true}).click();assert.equal(await palette.getByRole('button',{name:'Голубой',exact:true}).getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);await page.screenshot({path:`playwright-report/highlighter-${engine.name()}.png`});
  console.log(`${engine.name()}: palette, curved strokes, transparency, independent pen settings, undo/redo, persistence, erasing, PDF export and mobile palette passed.`);
 } finally {await browser.close();}
}} finally {await server.close();}
