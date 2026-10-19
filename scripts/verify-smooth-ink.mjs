import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium, webkit} from 'playwright';
import {strokePath} from '../src/components/board-strokes.js';

const server = await createServer({server:{host:'127.0.0.1',port:5192,strictPort:true}});
await server.listen();
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const width of [1440, 390]) {
        const page = await browser.newPage({viewport:{width,height:1000}});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:5192/board');
        await page.evaluate(() => document.fonts.ready);
        const paper = page.locator('.board-paper').first();
        const geometry = await page.evaluate(paths => {
          return paths.map(d => {
            const path = document.createElementNS('http://www.w3.org/2000/svg','path');
            path.setAttribute('d',d);
            const length=path.getTotalLength();
            return Array.from({length:1001},(_,i)=>{const p=path.getPointAtLength(length*i/1000);return [p.x,p.y];});
          });
        }, [strokePath([[0,20],[20,20],[20,0]],1),strokePath([[0,0],[10,20],[20,25],[30,20],[40,0]],1)]);
        assert.ok(geometry[0].some(([x,y])=>Math.hypot(x-20,y-20)<.05),'A mathematical right angle must keep its exact corner');
        assert.ok(geometry[1].every(([x,y])=>x>=0&&x<=40&&y>=0&&y<=25),'Smoothing must stay within the sampled bounds');
        const tools = page.locator('.board-tools > .board-tool, .board-tools > .board-figures > summary');
        const buttons = await tools.evaluateAll(nodes => nodes.map(node => ({
          text:node.textContent.trim(),label:node.getAttribute('aria-label'),title:node.title,
          width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,
        })));
        assert.equal(buttons.length, 7);
        assert.ok(buttons.every(b => !b.text && b.label && b.title && b.width >= 44 && b.height >= 44));
        const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items);
        // Real pointer capture, then several hardware samples in a single move.
        await paper.evaluate(svg => svg.addEventListener('pointerdown', event => {svg.inkPointer = event.pointerId;}));
        const box = await paper.boundingBox(), x = box.x + 35, y = box.y + 50;
        await page.mouse.move(x, y); await page.mouse.down();
        const input = [[x+8,y+3],[x+16,y+9],[x+24,y+18],[x+32,y+25]];
        await paper.evaluate((svg, samples) => {
          const event = new PointerEvent('pointermove', {bubbles:true,pointerId:svg.inkPointer,pointerType:'mouse',buttons:1,clientX:samples.at(-1)[0],clientY:samples.at(-1)[1]});
          Object.defineProperty(event, 'getCoalescedEvents', {value:() => samples.map(([clientX,clientY]) => ({clientX,clientY}))});
          svg.dispatchEvent(event);
        }, input);
        await page.waitForFunction(() => !!document.querySelector('.board-paper path[stroke="#212123"][d*="Q"]'));
        const live = await paper.locator('path[stroke="#212123"][d*="Q"]').getAttribute('d');
        assert.ok(live.includes('Q'), 'Curves must be visible before lifting the pen');
        // Finish at a position that never received pointermove.
        await paper.evaluate((svg, [clientX,clientY]) => {
          svg.dispatchEvent(new PointerEvent('pointerup', {bubbles:true,pointerId:svg.inkPointer,pointerType:'mouse',clientX,clientY}));
        }, [x+40,y+28]);
        await page.mouse.up();
        const first = (await stored())[0];
        assert.equal(first.smoothing, 1);
        assert.equal(first.points.length, 6, 'All coalesced samples and the release point are retained, without duplicates');
        const path = paper.locator('[data-shape-type="pen"]').first();
        const savedPath = await path.getAttribute('d');
        const end = await path.evaluate(node => {
          const p = node.getPointAtLength(node.getTotalLength());
          return new DOMPoint(p.x,p.y).matrixTransform(node.getScreenCTM()).toJSON();
        });
        assert.ok(Math.abs(end.x-x-40)<1 && Math.abs(end.y-y-28)<1, 'Endpoint must match release position');
        await page.getByRole('button',{name:'Отменить',exact:true}).click(); assert.equal((await stored()).length,0);
        await page.getByRole('button',{name:'Повторить',exact:true}).click(); assert.equal(await path.getAttribute('d'),savedPath);
        // Cancelling a draft before RAF must neither save it nor revive it later.
        await page.mouse.move(x+5,y+75); await page.mouse.down();
        await paper.evaluate(svg => {
          const init={bubbles:true,pointerId:svg.inkPointer,pointerType:'mouse',clientX:120,clientY:200};
          svg.dispatchEvent(new PointerEvent('pointermove',init));
          svg.dispatchEvent(new PointerEvent('pointercancel',init));
        });
        await page.mouse.up();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal((await stored()).length,1);
        await page.reload(); assert.equal(await path.getAttribute('d'),savedPath);
        // Preview a continuous handwritten wave rather than only a straight segment.
        const fresh = await paper.boundingBox();
        const wave = Array.from({length:101},(_,i)=>[fresh.x+25+i*1.5,fresh.y+130+Math.sin(i*.16)*20]);
        await page.mouse.move(...wave[0]); await page.mouse.down();
        for (const point of wave.slice(1)) await page.mouse.move(...point);
        await page.mouse.up();
        assert.ok((await paper.locator('[data-shape-type="pen"]').last().getAttribute('d')).includes('Q'));
        await page.screenshot({path:`playwright-report/smooth-ink-${engine.name()}-${width}.png`});
        // Older saved strokes retain their original geometry.
        await page.evaluate(() => {
          const key='uliana-whiteboard-v2',notebook=JSON.parse(localStorage.getItem(key));
          notebook.items.push({id:'legacy-ink',page:0,type:'pen',color:'#212123',size:4,points:[[100,100],[120,140],[140,100]]});
          localStorage.setItem(key,JSON.stringify(notebook));
        });
        await page.reload();
        assert.equal(await paper.locator('[data-shape-id="legacy-ink"]').getAttribute('d'),'M100,100 L120,140 L140,100');
        assert.deepEqual(errors,[]);
        console.log(`${engine.name()} ${width}: icon-only 44px tools, live smooth ink, coalesced samples, precise release, undo/redo, cancellation and persistence passed.`);
        await page.close();
      }
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
