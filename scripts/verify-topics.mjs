import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {rm} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,request} from 'playwright';
process.env.ACCOUNTS_DB_PATH=`.local/topics-check-${process.pid}.sqlite`;
const server=await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true}});await server.listen();
const origin='http://127.0.0.1:5178',browser=await chromium.launch();
const notebook={pageCount:1,items:[{id:randomUUID(),type:'pen',page:0,color:'#212123',size:4,points:[[200,300],[400,360]]}]};
try{
 const teacher=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}}),student=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}}),post=(ctx,action,data)=>ctx.post(`/api/account?action=${action}`,{data});
 await post(teacher,'setup',{login:'teacher',password:'Teacher-topics-12345'});
 const created=await(await post(teacher,'students',{login:'student01',password:'Student-topics-12345'})).json(),id=created.student.id;
 const other=await(await post(teacher,'students',{login:'student02',password:'Student-topics-12345'})).json();
 // Seed the legacy table to verify migration preserves the exact book and revision.
 const {database}=await import('../server/database.js'),{query}=await database();await query('INSERT INTO account_boards(student_id,notebook,revision) VALUES(?,?,?)',[id,JSON.stringify(notebook),7]);
 assert.equal((await(await teacher.get(`/api/account?action=board&studentId=${id}`)).json()).revision,7);
 const main=await(await teacher.get(`/api/account?action=board&studentId=${id}`)).json();assert.deepEqual(main.notebook,notebook);
 const topic=await(await post(teacher,'topics',{studentId:id,operation:'create',title:'Задание 18 ОГЭ'})).json();assert.ok(topic.topic.id);
 assert.equal((await post(teacher,'board',{studentId:id,topicId:topic.topic.id,notebook,revision:0})).status(),200);
 assert.equal((await post(teacher,'board',{studentId:id,topicId:topic.topic.id,notebook,revision:0})).status(),409);
 assert.equal((await(await teacher.get(`/api/account?action=board&studentId=${id}`)).json()).revision,7,'A topic save does not change the main book');
 await post(student,'login',{login:'student01',password:'Student-topics-12345'});
 assert.equal((await student.get(`/api/account?action=topics&studentId=${other.student.id}`)).status(),403);
 assert.equal((await student.get(`/api/account?action=board&topicId=${topic.topic.id}&studentId=${other.student.id}`)).status(),403);
 assert.equal((await post(student,'topics',{operation:'create',title:'Forbidden'})).status(),403);
 assert.deepEqual((await(await student.get(`/api/account?action=board&topicId=${topic.topic.id}`)).json()).notebook,notebook);
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(origin+'/cabinet');await page.getByLabel('Логин',{exact:true}).fill('teacher');await page.getByLabel('Пароль',{exact:true}).fill('Teacher-topics-12345');await page.getByRole('button',{name:'Войти',exact:true}).click();await page.getByRole('heading',{name:'Мои ученики',exact:true}).waitFor();await page.goto(origin+`/cabinet/board/${id}`);await page.locator('[data-shape-type="pen"]').waitFor();
 await page.getByLabel('Название новой доски').fill('Задание 5 ОГЭ');await page.getByRole('button',{name:'+ Создать доску',exact:true}).click();await page.getByRole('button',{name:'Задание 5 ОГЭ',exact:true}).waitFor();assert.equal(await page.locator('[data-shape-type="pen"]').count(),0);
 const newTopic=new URL(page.url()).searchParams.get('topic');assert.ok(newTopic);
 const paper=await page.locator('.board-paper').first().boundingBox();await page.mouse.move(paper.x+80,paper.y+100);await page.mouse.down();await page.mouse.move(paper.x+130,paper.y+140,{steps:5});await page.mouse.up();
 // Switching immediately flushes the new stroke instead of waiting for the debounce.
 await page.getByRole('button',{name:'Текущий урок',exact:true}).click();await page.getByRole('button',{name:'Текущий урок',exact:true}).waitFor();await page.waitForFunction(()=>!new URL(location.href).searchParams.has('topic'));
 assert.equal((await(await teacher.get(`/api/account?action=board&studentId=${id}&topicId=${newTopic}`)).json()).notebook.items.length,1);
 await page.getByRole('button',{name:'Задание 5 ОГЭ',exact:true}).click();await page.locator('[data-shape-type="pen"]').waitFor();
 await page.getByRole('button',{name:'Переименовать',exact:true}).click();await page.getByLabel('Новое название доски').fill('Уравнения');await page.getByRole('button',{name:'Сохранить название',exact:true}).click();await page.getByRole('button',{name:'Уравнения',exact:true}).waitFor();await page.getByRole('button',{name:'Поднять доску',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Уравнения',exact:true}).waitFor();assert.equal(await page.locator('[data-shape-type="pen"]').count(),1);assert.equal(new URL(page.url()).searchParams.get('topic'),newTopic);
 // A failed save keeps the active topic and local recovery data intact.
 const boardRequests=/\/api\/account\?action=board(?:&|$)/;
 await page.route(boardRequests,route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test storage failure'})}):route.continue());
 const r=await page.locator('.board-paper').first().boundingBox();await page.mouse.move(r.x+160,r.y+180);await page.mouse.down();await page.mouse.move(r.x+190,r.y+200,{steps:4});await page.mouse.up();await page.getByRole('button',{name:'Текущий урок',exact:true}).click();await page.getByRole('alert').filter({hasText:'Сначала нужно сохранить'}).waitFor();assert.equal(new URL(page.url()).searchParams.get('topic'),newTopic);assert.equal(await page.locator('[data-shape-type="pen"]').count(),2);assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('uliana-account-draft:'))));
 await page.unroute(boardRequests);await page.getByRole('button',{name:'Повторить сохранение',exact:true}).click();await page.getByRole('button',{name:'Повторить сохранение',exact:true}).waitFor({state:'hidden'});await page.getByRole('status').filter({hasText:'Доска сохраняется автоматически.'}).waitFor();
 // Undo back to the saved version before the debounce must not send the obsolete drawing.
 await page.mouse.move(r.x+220,r.y+220);await page.mouse.down();await page.mouse.move(r.x+240,r.y+240,{steps:4});await page.mouse.up();await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.getByRole('button',{name:'Текущий урок',exact:true}).click();await page.waitForFunction(()=>!new URL(location.href).searchParams.has('topic'));assert.equal((await(await teacher.get(`/api/account?action=board&studentId=${id}&topicId=${newTopic}`)).json()).notebook.items.length,2);
 await page.locator('.board-paper').first().waitFor();await page.waitForFunction(()=>document.querySelector('.board-topic-card.is-active')?.textContent.includes('Текущий урок'));await page.screenshot({path:'playwright-report/topic-boards-account.png',fullPage:true});
 // Anonymous books keep the old notebook and save their catalog separately.
 const local=await browser.newPage({viewport:{width:1440,height:1000}});await local.goto(origin+'/board');await local.evaluate(book=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify(book)),notebook);await local.reload();await local.getByLabel('Название новой доски').fill('Геометрия');await local.getByRole('button',{name:'+ Создать доску',exact:true}).click();assert.equal(await local.locator('[data-shape-type="pen"]').count(),0);await local.getByRole('button',{name:'Текущий урок',exact:true}).click();assert.equal(await local.locator('[data-shape-type="pen"]').count(),1);await local.reload();await local.getByRole('button',{name:'Геометрия',exact:true}).waitFor();assert.equal(await local.locator('[data-shape-type="pen"]').count(),1);
 // Clipboard images use IndexedDB assets; large raster data stays out of notebook JSON.
 await local.getByRole('button',{name:'Геометрия',exact:true}).click();await local.locator('.board-paper').first().waitFor();
 await local.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=400;const context=canvas.getContext('2d');context.fillStyle='#63a06c';context.fillRect(0,0,600,400);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),transfer=new DataTransfer();transfer.items.add(new File([blob],'screenshot.png',{type:'image/png'}));window.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true}));});
 await local.locator('image[data-board-asset]').waitFor();const pasted=await local.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key=>key.startsWith('uliana-whiteboard-topic:')))));assert.equal(pasted.items.length,1);assert.ok(pasted.items[0].assetId);assert.equal(pasted.items[0].src,undefined);assert.ok(JSON.stringify(pasted).length<2000);
 await local.reload();await local.getByRole('button',{name:'Геометрия',exact:true}).click();await local.waitForFunction(()=>document.querySelector('image[data-board-asset]')?.getAttribute('href')?.startsWith('blob:'));
 await local.setViewportSize({width:390,height:844});assert.equal(await local.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await local.screenshot({path:'playwright-report/topic-boards-phone.png'});
 console.log('Topics passed: legacy migration, isolated notebooks/revisions, student permissions, create/rename/reorder, immediate save before switch, failed-save protection, quick undo, URL persistence and anonymous catalog.');
}finally{await browser.close();await server.close();for(const suffix of['','-wal','-shm'])await rm(process.env.ACCOUNTS_DB_PATH+suffix,{force:true}).catch(()=>{});}
