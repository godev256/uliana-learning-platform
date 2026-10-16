import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:5177,strictPort:true}});await server.listen();
const fixture={pageCount:2,items:[
 {id:'pen-a',type:'pen',page:0,color:'#212123',size:4,points:[[200,200],[300,210]]},
 {id:'pen-b',type:'pen',page:0,color:'#212123',size:4,points:[[220,240],[320,250]]},
 {id:'rectangle',type:'rect',page:0,color:'#212123',size:4,points:[[400,200],[500,300]]},
 {id:'outside',type:'line',page:0,color:'#212123',size:4,points:[[700,400],[850,450]]},
 {id:'other-page',type:'pen',page:1,color:'#212123',size:4,points:[[200,200],[300,210]]}
]};
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5177/board');await page.evaluate(book=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify(book)),fixture);await page.reload();
  await page.getByRole('button',{name:'Ладошка',exact:true}).click();
  const paper=page.locator('.board-paper').first(),stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')));
  async function coordinates(x,y){return paper.evaluate((node,[x,y])=>{const p=new DOMPoint(x,y).matrixTransform(node.getScreenCTM());return [p.x,p.y];},[x,y]);}
  async function drag(from,to,{twice=false}={}){
   const a=await coordinates(...from),b=await coordinates(...to);await page.mouse.move(...a);
   if(twice)await page.mouse.click(...a);
   await page.mouse.down();await page.mouse.move(...b,{steps:8});await page.mouse.up();
  }
  // Trackpad double-press, then drag a box containing three separate objects.
  await drag([150,150],[550,350],{twice:true});await page.locator('[data-group-selection]').waitFor();assert.deepEqual(await stored(),fixture,'Selection itself must not alter saved work');
  assert.match(await paper.textContent(),/Выделено: 3/);
  await drag([350,260],[450,360]);
  let moved=await stored();for(const original of fixture.items){const actual=moved.items.find(item=>item.id===original.id);if(['pen-a','pen-b','rectangle'].includes(original.id)){for(let i=0;i<original.points.length;i++){assert.ok(Math.abs(actual.points[i][0]-original.points[i][0]-100)<2);assert.ok(Math.abs(actual.points[i][1]-original.points[i][1]-100)<2);}}else assert.deepEqual(actual,original);}
  await page.getByRole('button',{name:'Отменить',exact:true}).click();assert.deepEqual(await stored(),fixture,'A group move is one undo step');await page.getByRole('button',{name:'Повторить',exact:true}).click();assert.deepEqual(await stored(),moved);
  // A cancelled move changes neither coordinates nor history.
  const a=await coordinates(450,360),b=await coordinates(500,400);await page.mouse.move(...a);await page.mouse.down();await page.mouse.move(...b,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await stored(),moved);assert.equal(await page.locator('[data-group-selection]').count(),0);
  // Dragging backwards selects fully enclosed objects and excludes partially covered ones.
  await drag([650,480],[250,250],{twice:true});await page.locator('[data-group-selection]').waitFor();assert.match(await paper.textContent(),/Выделено: 3/);
  await page.screenshot({path:`playwright-report/group-selection-${engine.name()}.png`});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Ручка',exact:true}).click();assert.equal(await page.locator('[data-group-selection]').count(),0);assert.deepEqual(errors,[]);
  console.log(`${engine.name()}: double-press marquee, grouped movement, page isolation, undo/redo, cancel and reverse selection passed.`);
 }finally{await browser.close();}
}}finally{await server.close();}
