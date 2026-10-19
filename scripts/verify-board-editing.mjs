import assert from 'node:assert/strict';
import {jsPDF} from 'jspdf';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:5193,strictPort:true}});
await server.listen();
const pdf=new jsPDF();pdf.text('Page one',20,30);pdf.addPage();pdf.text('Page two',20,30);
const pdfBuffer=Buffer.from(pdf.output('arraybuffer'));
let clipboardBrowser,clipboardPage,clipboardOriginal;
try {for(const engine of [chromium,webkit]) {
 const browser=await engine.launch();
 if(engine===chromium)clipboardBrowser=browser;
 try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},...(engine===chromium?{permissions:['clipboard-read','clipboard-write']}:{})});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5193/board');
 const book=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')));
 const paper=page.locator('.board-paper').first(),frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 // Paste a screenshot from the native image clipboard in Chromium; WebKit uses
 // the same paste event with image data to cover its independent decoder.
 const image=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=300;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fbfaf6';ctx.fillRect(0,0,600,300);ctx.fillStyle='#212123';ctx.font='32px sans-serif';ctx.fillText('x² + y² = 25',35,90);
  return canvas.toDataURL('image/png');
 });
 let backup;
 if(engine===chromium){
  backup=await page.evaluate(async()=>Promise.all((await navigator.clipboard.read()).map(async item=>Object.fromEntries(await Promise.all(item.types.map(async type=>{
   const blob=await item.getType(type);return [type,await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);})];
  }))))));
  clipboardPage=page;clipboardOriginal=backup;
 }
 try {
 if(engine===chromium){await page.evaluate(async data=>navigator.clipboard.write([new ClipboardItem({'image/png':await(await fetch(data)).blob()})]),image);await page.keyboard.press('Meta+V');}
 else await page.evaluate(async data=>{const dt=new DataTransfer();dt.items.add(new File([await(await fetch(data)).blob()],'screenshot.png',{type:'image/png'}));window.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt}));},image);
 await paper.locator('[data-shape-type="image"]').waitFor();
 const initialImage=(await book()).items.find(i=>i.type==='image');
 const screen=async points=>paper.evaluate((svg,points)=>points.map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return [p.x,p.y];}),points);
 const draw=async(points)=>{const pts=await screen(points);await page.mouse.move(...pts[0]);await page.mouse.down();for(const p of pts.slice(1))await page.mouse.move(...p,{steps:4});await page.mouse.up();};
 const x=initialImage.points[0][0]+50,y=initialImage.points[0][1]+50;
 await draw([[x,y],[x+100,y+40]]);
 await page.getByRole('button',{name:'Выделитель',exact:true}).click();await page.keyboard.press('Escape');
 await draw([[x,y+90],[x+100,y+90]]);
 // A geometric figure and screenshot must survive the eraser.
 await page.locator('summary[aria-label="Фигуры"]').click();await page.getByRole('button',{name:'Прямоугольник',exact:true}).click();
 await draw([[100,100],[300,250]]);
 await page.getByRole('button',{name:'Ластик',exact:true}).click();
 for(const pt of [[150,100],[x+45,y+18],[x+45,y+90],[x+200,y+150]])await page.mouse.click(...(await screen([pt]))[0]);
 assert.equal((await book()).items.filter(i=>['pen','highlighter'].includes(i.type)).length,0);
 assert.equal((await book()).items.filter(i=>i.type==='image').length,1);
 assert.equal((await book()).items.filter(i=>i.type==='rect').length,1);
 // P works from every primary tool, including a focused thickness slider.
 for(const name of ['Ладошка','Выделитель','Ластик','Линия']){
  await page.getByRole('button',{name,exact:true}).click();await page.keyboard.press('p');
  assert.equal(await page.getByRole('button',{name:'Ручка',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByRole('dialog').count(),0);
 }
 await page.getByRole('button',{name:'Выделитель',exact:true}).click();await page.getByRole('slider').focus();await page.keyboard.press('Shift+P');
 assert.equal(await page.getByRole('button',{name:'Ручка',exact:true}).getAttribute('aria-pressed'),'true');
 // The topic field is labelled through its parent, so use the visible input.
 const input=page.locator('.board-topic-create input').first();await input.fill('');await input.press('p');assert.equal(await input.inputValue(),'p');await input.fill('');await input.blur();
 // Select screenshot with the hand, copy/paste via macOS keyboard shortcuts.
 await page.getByRole('button',{name:'Ладошка',exact:true}).click();
 await page.mouse.click(...(await screen([[x+200,y+150]]))[0]);
 await page.keyboard.press('Meta+C');await page.keyboard.press('Meta+V');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.filter(i=>i.type==='image').length===2);
 const images=(await book()).items.filter(i=>i.type==='image');assert.notEqual(images[0].id,images[1].id);assert.equal(images[0].assetId,images[1].assetId);
 await page.keyboard.press('Delete');assert.equal((await book()).items.filter(i=>i.type==='image').length,1);
 await page.keyboard.press('Meta+Z');assert.equal((await book()).items.filter(i=>i.type==='image').length,2);
 await page.keyboard.press('Meta+Shift+Z');assert.equal((await book()).items.filter(i=>i.type==='image').length,1);
 // Group paste after switching to the pen keeps the whole copied group selected.
 await page.keyboard.press('Escape');
 const area=await screen([[40,40],[1550,1500]]);await page.mouse.move(...area[0]);await page.mouse.down();await page.mouse.move(...area[1],{steps:6});await page.mouse.up();
 assert.equal(await page.locator('[data-group-selection]').count(),1);
 await page.keyboard.press('Meta+C');await page.keyboard.press('p');await page.keyboard.press('Meta+V');await frame();
 assert.equal((await book()).items.length,4);assert.equal(await page.locator('[data-group-selection]').count(),1);
 await page.keyboard.press('Backspace');assert.equal((await book()).items.length,2);
 // Physical P also works with another keyboard layout; text fields retain typing.
 await page.getByRole('button',{name:'Ластик',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'з',code:'KeyP',bubbles:true,cancelable:true})));
 assert.equal(await page.getByRole('button',{name:'Ручка',exact:true}).getAttribute('aria-pressed'),'true');
 await input.fill('Notes');await input.selectText();await page.keyboard.press('Meta+C');await input.fill('');await page.keyboard.press('Meta+V');assert.equal(await input.inputValue(),'Notes');await input.press('Backspace');assert.equal((await book()).items.length,2);await input.fill('');await input.blur();
 // PDF page insertion retains the order and contents of all existing pages.
 await page.getByLabel('PDF как доска').setInputFiles({name:'Notes test.pdf',mimeType:'application/pdf',buffer:pdfBuffer});
 await page.getByText('Рабочий лист PDF',{exact:true}).waitFor({state:'attached'});assert.equal(await page.locator('.board-paper').count(),2);
 await draw([[180,200],[300,220]]);
 const pdfKey=await page.evaluate(()=>Object.keys(localStorage).find(key=>key.startsWith('uliana-whiteboard-topic:')));
 const pdfBook=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),pdfKey);
 const before=await pdfBook();
 await page.getByRole('button',{name:'+ Добавить лист',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Лист в клетку для заметок',exact:true});await dialog.waitFor();assert.equal(await dialog.getByRole('combobox').inputValue(),'0');
 await dialog.getByRole('button',{name:'Вставить лист',exact:true}).click();assert.equal(await page.locator('.board-paper').count(),3);
 const after=await pdfBook();assert.deepEqual(after.items,before.items.map(i=>({...i,page:i.page+1})));
 assert.equal(await paper.locator('[data-page-grid]').count(),1);assert.equal(await page.locator('.board-paper').nth(1).locator('[data-page-grid]').count(),0);
 await page.keyboard.press('Meta+Z');assert.equal(await page.locator('.board-paper').count(),2);assert.deepEqual((await pdfBook()).items,before.items);
 await page.keyboard.press('Meta+Shift+Z');assert.equal(await page.locator('.board-paper').count(),3);
 await page.getByRole('button',{name:'+ Добавить лист',exact:true}).click();await dialog.getByRole('combobox').selectOption('2');await dialog.getByRole('button',{name:'Вставить лист',exact:true}).click();
 assert.equal(await page.locator('.board-paper').count(),4);assert.equal(await page.locator('.board-paper').nth(2).locator('[data-page-grid]').count(),1);
 assert.deepEqual((await pdfBook()).items.filter(i=>i.background).map(i=>[i.sourcePage,i.page]),[[1,1],[2,3]]);
 const saved=await pdfBook();await page.reload();await page.getByRole('button',{name:'Notes test',exact:true}).click();await page.getByText('Рабочий лист PDF',{exact:true}).waitFor({state:'attached'});assert.deepEqual(await pdfBook(),saved);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();assert.equal(await(await download).failure(),null);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'+ Добавить лист',exact:true}).click();await dialog.waitFor();const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);await page.screenshot({path:`playwright-report/board-editing-${engine.name()}.png`});await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
 assert.deepEqual(errors,[]);console.log(`${engine.name()}: ink-only eraser, protected screenshots/figures, P shortcuts, Mac copy/paste/delete/undo, PDF note-page placement, grid, persistence, export and mobile dialog passed.`);
 }finally {
  if(backup)await page.evaluate(async rows=>{if(!rows.length)return navigator.clipboard.writeText('');await navigator.clipboard.write(await Promise.all(rows.map(async formats=>new ClipboardItem(Object.fromEntries(await Promise.all(Object.entries(formats).map(async([type,data])=>[type,await(await fetch(data)).blob()])))))));},backup).catch(()=>{});
 }
 }finally{if(engine!==chromium)await browser.close();}
}}finally{
 if(clipboardPage&&!clipboardPage.isClosed()&&clipboardOriginal)await clipboardPage.evaluate(async rows=>{if(!rows.length)return navigator.clipboard.writeText('');await navigator.clipboard.write(await Promise.all(rows.map(async formats=>new ClipboardItem(Object.fromEntries(await Promise.all(Object.entries(formats).map(async([type,data])=>[type,await(await fetch(data)).blob()])))))));},clipboardOriginal).catch(()=>{});
 await clipboardBrowser?.close();await server.close();
}
