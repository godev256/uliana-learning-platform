import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
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
  await page.getByRole('button',{name:'Ладошка',exact:true}).click();await selectPhoto();await page.getByRole('button',{name:'Обрезать',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0,'Crop edits the image on the sheet without a modal');assert.equal(await page.locator('.board-paper .board-inline-crop').count(),1);
  const stage=page.locator('.board-crop-stage');async function crop(x,y,endX,endY){const r=await stage.evaluate(el=>{const matrix=el.getScreenCTM(),a=new DOMPoint(0,0).matrixTransform(matrix),b=new DOMPoint(1,1).matrixTransform(matrix);return{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y};});await page.mouse.move(r.x+r.width*x,r.y+r.height*y);await page.mouse.down();await page.mouse.move(r.x+r.width*endX,r.y+r.height*endY,{steps:6});await page.mouse.up();}
  // WebKit rounds pointer coordinates to screen pixels; the sheet can be zoomed out.
  const tolerance=await stage.evaluate(el=>{const m=el.getScreenCTM();return 1.5/Math.min(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));}),positionTolerance=Math.max(2,600*tolerance);
  await crop(.25,.25,.75,.75);await page.screenshot({path:`playwright-report/crop-inline-${engine.name()}-${width}.png`});await page.getByRole('button',{name:'Применить обрезку',exact:true}).click();
  const book=await stored(),photo=book.items[0];assert.ok(Math.abs(photo.crop.x-.25)<tolerance);assert.ok(Math.abs(photo.crop.width-.5)<tolerance);assert.ok(Math.abs(photo.points[0][0]-350)<positionTolerance);assert.ok(Math.abs(photo.points[0][1]-300)<positionTolerance);assert.deepEqual(book.items[1],fixture.items[1],'Annotations keep their position');assert.equal(photo.src,fixture.items[0].src,'Source pixels are retained');
  // The cropped image renders real pixels rather than an empty nested SVG.
  await page.keyboard.press('Escape');const image=page.locator('[data-shape-type="image"]');await image.scrollIntoViewIfNeeded();const pixels=await sharp(await image.screenshot()).raw().toBuffer({resolveWithObject:true});const middle=(Math.floor(pixels.info.height/2)*pixels.info.width+Math.floor(pixels.info.width/2))*pixels.info.channels;assert.ok(pixels.data[middle+1]>120&&pixels.data[middle]<60,'Cropped image remains visible');
  await page.getByRole('button',{name:'Отменить',exact:true}).click();assert.deepEqual(await stored(),fixture);await page.getByRole('button',{name:'Повторить',exact:true}).click();assert.deepEqual(await stored(),book);
  await page.reload();assert.deepEqual(await stored(),book,'Crop survives reload');await page.getByRole('button',{name:'Ладошка',exact:true}).click();await selectPhoto();await page.getByRole('button',{name:'Обрезать',exact:true}).click();await crop(.2,.2,.8,.8);await page.getByRole('button',{name:'Отмена',exact:true}).click();assert.deepEqual(await stored(),book,'Cancelling preserves the image');
  await page.getByRole('button',{name:'Обрезать',exact:true}).click();await crop(.2,.2,.8,.8);await page.getByRole('button',{name:'Применить обрезку',exact:true}).click();const twice=(await stored()).items[0];assert.ok(Math.abs(twice.crop.x-.35)<tolerance*2);assert.ok(Math.abs(twice.crop.width-.3)<tolerance*2,'Repeated crops compose correctly');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать конспект PDF',exact:true}).click();assert.match((await download).suggestedFilename(),/\.pdf$/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log(`${engine.name()} ${width}px: crop, pixels, annotations, undo/redo, reload, cancel, repeated crop and PDF passed.`);await page.close();
 }}finally{await browser.close();}
}}finally{await server.close();}
