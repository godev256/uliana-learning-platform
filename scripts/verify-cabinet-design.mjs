// Fixture API keeps this visual/interaction check separate from private accounts.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
process.env.GO_API_URL='http://127.0.0.1:1';
const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch(),errors=[];
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());
const month=today.slice(0,7),year=Number(month.slice(0,4));
mkdirSync('playwright-report/design',{recursive:true});
try{
 for(const width of[320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/account**',route=>{
   const action=new URL(route.request().url()).searchParams.get('action')||'session';
   return route.fulfill({json:action==='session'?{user:{id:'design-teacher',role:'teacher',login:'ulianaa'}}:action==='profile'?{student:{id:'design-student',login:'alexandra',role:'student'},schedule:[{day:1,time:'17:30',duration:60}],calendar:[],lessons:[{date:month+'-07',grade:8,homework:90,note:'Разобрали квадратные уравнения.'}]}:{ok:true}});
  });
  await page.goto(origin+'/cabinet/student/design-student');
  const results=page.getByRole('group',{name:'Период результатов',exact:true});
  await page.getByLabel('Оценка урока 1',{exact:true}).selectOption('9');
  await results.getByRole('button',{name:'Предыдущий месяц результатов',exact:true}).click();
  await page.getByRole('heading',{name:'Пока нет записей за этот месяц'}).waitFor();
  await results.getByRole('button',{name:'Следующий месяц результатов',exact:true}).click();
  assert.equal(await page.getByLabel('Оценка урока 1',{exact:true}).inputValue(),'9','Changing periods preserves unsaved edits');
  const trigger=results.getByRole('button',{name:/^Выбрать месяц результатов:/});
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Выбор периода результатов'});
  assert.equal(await dialog.getByRole('button',{pressed:true}).count(),1);
  assert.ok(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),'Picker stays inside the viewport');
  await page.screenshot({path:`playwright-report/design/period-${width}.png`});
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.ok(await trigger.evaluate(el=>el===document.activeElement));
  await trigger.click();await dialog.getByRole('button',{name:`Декабрь ${year}`,exact:true}).click();
  await results.getByRole('button',{name:'Следующий месяц результатов',exact:true}).click();
  assert.match(await trigger.getAttribute('aria-label'),new RegExp(`Январь ${year+1}$`),'December advances to January of next year');
  await trigger.click();await dialog.getByRole('button',{name:'Предыдущий год результатов',exact:true}).click();await dialog.getByRole('button',{name:`Декабрь ${year}`,exact:true}).click();
  await trigger.click();await dialog.getByRole('button',{name:'Этот месяц',exact:true}).click();
  assert.equal(await page.getByLabel('Оценка урока 1',{exact:true}).inputValue(),'9');
  await trigger.click();await page.getByRole('heading',{name:'alexandra',exact:true}).click();assert.equal(await dialog.count(),0,'Click outside closes picker');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`playwright-report/design/profile-${width}.png`,fullPage:true});
  await page.goto(origin+'/');
  await page.getByRole('heading',{level:1}).waitFor();
  assert.equal(await page.locator('.site-cabinet-link').getAttribute('href'),'/cabinet');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Home fits all viewports');
  if(width===390)assert.ok(await page.locator('.home-hero .pill-link--solid').evaluate(el=>el.getBoundingClientRect().bottom<844),'Booking action is visible on the first phone screen');
  assert.equal(await page.getByRole('button',{name:'Меню сайта',exact:true}).count(),0,'Header uses the cabinet link without a redundant menu');
  assert.equal(await page.locator('.home-contact-form').isVisible(),width>640,'Full booking form is shown above phone widths');
  assert.equal(await page.locator('.home-contact-phone').isVisible(),width<=640,'Phones offer direct diagnostic booking');
  assert.equal(await page.locator('.home-contact-phone').getAttribute('href'),'https://t.me/ulianaa713');
  await page.screenshot({path:`playwright-report/design/home-${width}.png`,fullPage:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: responsive home/profile at 320/390/768/1440px; period picker, keyboard dismissal, year rollover and unsaved edits.');
}finally{await browser.close();await server.close();}
