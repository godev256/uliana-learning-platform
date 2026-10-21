import assert from 'node:assert/strict';
import sharp from 'sharp';
import {moveCrop,resizeCrop} from '../src/components/board-crop-geometry.js';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
const area={x:.2,y:.2,width:.5,height:.5};
const right=resizeCrop(area,3,[.1,.3]);assert.equal(right.y,area.y);assert.ok(Math.abs(right.height-area.height)<1e-8);assert.ok(Math.abs(right.width-.6)<1e-8,'Dragging a side preserves the other edges');
for(let handle=0;handle<8;handle++)for(const delta of [[-5,-5],[5,5]]){const result=resizeCrop(area,handle,delta);assert.ok(result.x>=0&&result.y>=0&&result.width>=.02-1e-8&&result.height>=.02-1e-8&&result.x+result.width<=1+1e-8&&result.y+result.height<=1+1e-8,'Frame stays inside the image and never flips');}
assert.deepEqual(moveCrop(area,[5,-5]),{x:.5,y:0,width:.5,height:.5},'Moving the frame preserves its size and clamps to the image');
const server=await createServer({server:{host:'127.0.0.1',port:5177,strictPort:true}});await server.listen();
const png=await sharp({create:{width:600,height:400,channels:3,background:'#13a856'}}).png().toBuffer();
const fixture={pageCount:1,items:[{id:'photo',type:'image',page:0,color:'#212123',size:4,src:`data:image/png;base64,${png.toString('base64')}`,points:[[200,200],[800,600]]},{id:'annotation',type:'pen',page:0,color:'#212123',size:4,points:[[350,350],[500,370]]}]};
try{for(const engine of [chromium,webkit].filter(engine=>!process.env.CROP_ENGINE||engine.name()===process.env.CROP_ENGINE)){
 const browser=await engine.launch();try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:950}});await page.goto('http://127.0.0.1:5177/board');await page.evaluate(book=>localStorage.setItem('uliana-whiteboard-v2',JSON.stringify(book)),fixture);await page.reload();
  async function selectPhoto(){const hit=page.locator('[data-select-id="photo"]');await hit.scrollIntoViewIfNeeded();const r=await hit.boundingBox();await page.mouse.click(r.x+r.width*.8,r.y+r.height*.8);}
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('uliana-whiteboard-v2')));
  await page.getByRole('button',{name:'Ладошка',exact:true}).click();await selectPhoto();
  await page.keyboard.press('KeyP');await page.getByRole('button',{name:'Ручка',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'Настройки ручки'}).getByRole('slider',{name:'Толщина ручки',exact:true}).inputValue(),'3','Selecting an image must not overwrite the default pen width');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Ладошка',exact:true}).click();await selectPhoto();assert.equal(await page.getByRole('button',{name:'Обрезать',exact:true}).locator('text').count(),0,'Crop button uses an icon');await page.getByRole('button',{name:'Обрезать',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0,'Crop edits the image on the sheet without a modal');assert.equal(await page.locator('.board-paper .board-inline-crop').count(),1);
  const stage=page.locator('.board-crop-stage');
  async function dragHandle(index,x,y){
   const start=await stage.locator(`g[data-crop-handle="${index}"] > rect`).last().evaluate(el=>{const p=new DOMPoint(Number(el.getAttribute('x'))+Number(el.getAttribute('width'))/2,Number(el.getAttribute('y'))+Number(el.getAttribute('height'))/2);return p.matrixTransform(el.getScreenCTM()).toJSON();});
   const end=await stage.evaluate((el,[x,y])=>new DOMPoint(x,y).matrixTransform(el.getScreenCTM()).toJSON(),[x,y]);
   await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up();
  }
  async function crop(x,y,endX,endY){await dragHandle(0,x,y);await dragHandle(4,endX,endY);}

  // WebKit rounds pointer coordinates to screen pixels; the sheet can be zoomed out.
  const tolerance=await stage.evaluate(el=>{const m=el.getScreenCTM();return 1.5/Math.min(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));}),positionTolerance=Math.max(2,600*tolerance);
  await crop(.25,.25,.75,.75);
  async function dragArea(from,to){const points=await stage.evaluate((el,points)=>points.map(([x,y])=>new DOMPoint(x,y).matrixTransform(el.getScreenCTM()).toJSON()),[from,to]);await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:8});await page.mouse.up();}
  const readArea=()=>stage.locator('rect[stroke="white"]').evaluate(el=>Object.fromEntries(['x','y','width','height'].map(key=>[key,Number(el.getAttribute(key))])));
  await dragArea([.75,.5],[.85,.5]);let resized=await readArea();assert.ok(Math.abs(resized.width-.6)<tolerance*2);assert.ok(Math.abs(resized.x-.25)<tolerance*2,'Dragging the right border keeps the left edge still');
  const center=[resized.x+resized.width/2,resized.y+resized.height/2];await dragArea(center,[center[0]+.05,center[1]+.05]);const moved=await readArea();assert.ok(Math.abs(moved.x-resized.x-.05)<tolerance*2);assert.ok(Math.abs(moved.y-resized.y-.05)<tolerance*2);assert.ok(Math.abs(moved.width-resized.width)<1e-8,'Dragging inside moves the frame without resizing');
  await page.getByRole('button',{name:'Сбросить рамку',exact:true}).click();await crop(.25,.25,.75,.75);await page.screenshot({path:`playwright-report/crop-inline-${engine.name()}-${width}.png`});await page.getByRole('button',{name:'Применить обрезку',exact:true}).click();
  const book=await stored(),photo=book.items[0];assert.ok(Math.abs(photo.crop.x-.25)<tolerance);assert.ok(Math.abs(photo.crop.width-.5)<tolerance);assert.ok(Math.abs(photo.points[0][0]-350)<positionTolerance);assert.ok(Math.abs(photo.points[0][1]-300)<positionTolerance);assert.deepEqual(book.items[1],fixture.items[1],'Annotations keep their position');assert.equal(photo.src,fixture.items[0].src,'Source pixels are retained');
  // The cropped image renders real pixels rather than an empty nested SVG.
  await page.keyboard.press('Escape');const image=page.locator('[data-shape-type="image"]');await image.scrollIntoViewIfNeeded();const pixels=await sharp(await image.screenshot()).raw().toBuffer({resolveWithObject:true});const middle=(Math.floor(pixels.info.height/2)*pixels.info.width+Math.floor(pixels.info.width/2))*pixels.info.channels;assert.ok(pixels.data[middle+1]>120&&pixels.data[middle]<60,'Cropped image remains visible');
  await page.getByRole('button',{name:'Отменить',exact:true}).click();assert.deepEqual(await stored(),fixture);await page.getByRole('button',{name:'Повторить',exact:true}).click();assert.deepEqual(await stored(),book);
  await page.reload();assert.deepEqual(await stored(),book,'Crop survives reload');await page.getByRole('button',{name:'Ладошка',exact:true}).click();await selectPhoto();assert.equal(await page.getByRole('button',{name:'Обрезать',exact:true}).locator('text').count(),0,'Crop button uses an icon');await page.getByRole('button',{name:'Обрезать',exact:true}).click();await crop(.2,.2,.8,.8);await page.getByRole('button',{name:'Отмена',exact:true}).click();assert.deepEqual(await stored(),book,'Cancelling preserves the image');
  assert.equal(await page.getByRole('button',{name:'Обрезать',exact:true}).locator('text').count(),0,'Crop button uses an icon');await page.getByRole('button',{name:'Обрезать',exact:true}).click();await crop(.2,.2,.8,.8);await page.getByRole('button',{name:'Применить обрезку',exact:true}).click();const twice=(await stored()).items[0];assert.ok(Math.abs(twice.crop.x-.35)<tolerance*2);assert.ok(Math.abs(twice.crop.width-.3)<tolerance*2,'Repeated crops compose correctly');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();assert.match((await download).suggestedFilename(),/\.pdf$/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log(`${engine.name()} ${width}px: icon, corners, side resizing, frame movement, crop, pixels, annotations, undo/redo, reload, cancel, repeated crop and PDF passed.`);await page.close();
 }}finally{await browser.close();}
}}finally{await server.close();}
