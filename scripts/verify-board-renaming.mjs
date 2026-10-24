import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {rm,readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {jsPDF} from 'jspdf';
import sharp from 'sharp';
process.env.ACCOUNTS_DB_PATH=`.local/rename-check-${process.pid}.sqlite`;
const server=await createServer({server:{host:'127.0.0.1',port:5187,strictPort:true}});await server.listen();const origin='http://127.0.0.1:5187';
try{for(const engine of [chromium,webkit]){const browser=await engine.launch();try{
 const tc=await browser.newContext({viewport:{width:1440,height:1000}}),sc=await browser.newContext({viewport:{width:1440,height:1000}}),post=(ctx,action,data)=>ctx.request.post(`${origin}/api/account?action=${action}`,{headers:{Origin:origin},data});
 await post(tc,engine===chromium?'setup':'login',{login:'teacher',password:'Teacher-rename-12345'});
 const login=`pupil-${engine.name()}`,created=await post(tc,'students',{login,password:'Student-rename-12345'}),id=(await created.json()).student.id;await post(sc,'login',{login,password:'Student-rename-12345'});
 const doc=new jsPDF();doc.text('Original math worksheet',20,20);const pdf=Buffer.from(doc.output('arraybuffer')),assetId=randomUUID();
 const upload=async(assetId,mime,bytes)=>assert.equal((await post(tc,'asset',{studentId:id,assetId,mime,part:0,total:1,data:bytes.toString('base64')})).status(),200);
 await upload(assetId,'application/pdf',pdf);
 const png=await sharp({create:{width:500,height:700,channels:3,background:'white'}}).png().toBuffer();await upload(`${assetId}:page:1`,'image/png',png);
 const pdfTopic=await post(tc,'topics',{studentId:id,operation:'create',title:'Исходный PDF',document:{assetId,name:'Исходный PDF.pdf',pageCount:1,pages:[{assetId:`${assetId}:page:1`,width:500,height:700}]}});assert.equal(pdfTopic.status(),201);const pdfTopicId=(await pdfTopic.json()).topic.id;
 const initial=await(await tc.request.get(`${origin}/api/account?action=board&studentId=${id}`)).json();
 const attachment={id:randomUUID(),page:0,type:'attachment',assetId,name:'Материал.pdf',format:'pdf',mime:'application/pdf',pageCount:1,color:'#212123',size:4,points:[[200,100],[960,1140]]};
 assert.equal((await post(tc,'board',{studentId:id,revision:initial.revision,notebook:{pageCount:1,items:[attachment]}})).status(),200);
 const t=await tc.newPage(),s=await sc.newPage(),errors=[];t.setDefaultTimeout(10000);s.setDefaultTimeout(10000);for(const page of[t,s])page.on('pageerror',e=>errors.push(e.message));
 await Promise.all([t.goto(`${origin}/cabinet/board/${id}`),s.goto(`${origin}/cabinet/board/${id}`)]);await Promise.all([t.locator('.board-paper').waitFor(),s.locator('.board-paper').waitFor()]);
 const openRename=async()=>{await t.getByRole('button',{name:'Настройки доски',exact:true}).click();await t.getByRole('button',{name:'Переименовать',exact:true}).click();};await openRename();await t.getByLabel('Новое название доски',{exact:true}).fill('16 тип ОГЭ');await t.getByRole('button',{name:'Сохранить название',exact:true}).click();await s.getByRole('button',{name:'16 тип ОГЭ',exact:true}).waitFor();assert.equal(await s.getByRole('button',{name:/^Переименовать/}).count(),0);
 // Open the PDF topic, then rename it through its settings.
 await t.getByRole('button',{name:'Исходный PDF',exact:true}).click();await openRename();await t.getByLabel('Новое название доски',{exact:true}).fill('План местности');await t.getByRole('button',{name:'Сохранить название',exact:true}).click();await s.getByRole('button',{name:'План местности',exact:true}).waitFor();assert.equal(new URL(t.url()).searchParams.get('topic'),pdfTopicId);await t.getByRole('button',{name:'16 тип ОГЭ',exact:true}).click();
 assert.equal((await post(sc,'topics',{studentId:id,operation:'rename',topicId:'main',title:'Запрещено'})).status(),403);
 // Rename the actual attachment, preserve its bytes and file extension.
 await t.getByRole('button',{name:'Открыть файл Материал.pdf',exact:true}).click();await t.getByRole('button',{name:'Переименовать файл',exact:true}).click();const title=t.getByLabel('Новое название файла',{exact:true});assert.equal(await title.inputValue(),'Материал');await title.fill('   ');assert.ok(await t.getByRole('button',{name:'Сохранить название файла',exact:true}).isDisabled());await title.fill('Задания к уроку');await t.getByRole('button',{name:'Сохранить название файла',exact:true}).click();await t.getByRole('heading',{name:'Задания к уроку.pdf',exact:true}).waitFor();
 await s.getByRole('button',{name:'Открыть файл Задания к уроку.pdf',exact:true}).waitFor();await s.getByRole('button',{name:'Открыть файл Задания к уроку.pdf',exact:true}).click();assert.equal(await s.getByRole('button',{name:'Переименовать файл',exact:true}).count(),0);
 const downloaded=t.waitForEvent('download');await t.getByRole('button',{name:'Скачать оригинал',exact:true}).click();const download=await downloaded;assert.equal(download.suggestedFilename(),'Задания к уроку.pdf');assert.deepEqual(await readFile(await download.path()),pdf);
 await t.screenshot({path:`playwright-report/renamed-file-${engine.name()}.png`});await Promise.all([t.reload(),s.reload()]);await t.getByRole('button',{name:'Открыть файл Задания к уроку.pdf',exact:true}).waitFor();await s.getByRole('button',{name:'Открыть файл Задания к уроку.pdf',exact:true}).waitFor();await t.getByRole('button',{name:'План местности',exact:true}).waitFor();
 const persisted=await(await tc.request.get(`${origin}/api/account?action=board&studentId=${id}`)).json();assert.equal(persisted.notebook.items[0].name,'Задания к уроку.pdf');assert.equal(persisted.notebook.items[0].assetId,assetId);
 console.log('desktop rename checks passed',engine.name());await t.setViewportSize({width:390,height:844});await t.screenshot({path:'playwright-report/rename-mobile-before.png'});if(!await t.locator('.board-topic-rail details').evaluate(node=>node.open))await t.locator('.board-topic-rail summary').click();await openRename();await t.getByLabel('Новое название доски',{exact:true}).waitFor();await t.getByRole('button',{name:'Отмена',exact:true}).click();assert.deepEqual(errors,[]);
 console.log(`${engine.name()}: teacher board/PDF-topic/file rename, live student titles, student restrictions, validation, original PDF bytes, persistence, mobile edit/cancel passed.`);await tc.close();await sc.close();
}finally{await browser.close();}}}finally{await server.close();for(const suffix of['','-wal','-shm'])await rm(process.env.ACCOUNTS_DB_PATH+suffix,{force:true}).catch(()=>{});}
