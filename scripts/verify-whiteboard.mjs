import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole("button", { name: "Меню сайта" }).click();
  await page.getByRole("navigation", { name: "Меню сайта" }).getByRole("link", { name: /Доска/ }).click();
  await page.getByRole("heading", { name: "Математическая доска" }).waitFor();
  const paper = page.locator(".board-paper").first();
  assert.equal(await page.locator(".board-paper").count(), 3, "Start with three sheets");
  const expectCount = async (expected) => {
    await page.waitForFunction(value => document.querySelectorAll(".board-paper [data-shape-id]").length === value, expected);
    assert.equal(await paper.locator("[data-shape-id]").count(), expected);
  };
  const screenPoint = async (x, y) => page.evaluate(([x, y]) => {
    const point = new DOMPoint(x, y).matrixTransform(document.querySelector('.board-paper').getScreenCTM());
    return { x: point.x, y: point.y };
  }, [x, y]);
  async function drawAt(x, y) {
    await paper.evaluate((element, y) => {
      const rect = element.getBoundingClientRect();
      window.scrollTo(0, scrollY + rect.top + rect.height * y / element.viewBox.baseVal.height - 350);
    }, y);
    const from = await screenPoint(x, y), to = await screenPoint(x + 220, y + 140);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  }
  await drawAt(150, 140);
  await expectCount(1);
  const shapeNames = ['Прямоугольник', 'Квадрат', 'Овал', 'Равнобедренный треугольник', 'Параллелограмм', 'Ромб', 'Равнобедренная трапеция', 'Прямоугольная трапеция', 'Произвольная трапеция'];
  for (const [index, name] of shapeNames.entries()) {
    await page.locator('summary[aria-label="Фигуры"]').click();
    await page.getByRole('button', { name, exact: true }).click();
    await drawAt(150 + (index % 3) * 450, 400 + Math.floor(index / 3) * 400);
  }
  await page.getByRole('button', { name: 'Линия', exact: true }).click();
  await drawAt(150, 1800);
  await expectCount(11);
  const square = paper.locator('[data-shape-type="square"]');
  assert.ok(Math.abs(Number(await square.getAttribute('width')) - Number(await square.getAttribute('height'))) < .001, 'Square sides must match');
  const vertices = async type => paper.locator('[data-shape-type="' + type + '"]').evaluate(element => [...element.points].map(p => [p.x, p.y]));
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const iso = await vertices('trapezoid-isosceles');
  assert.ok(Math.abs(distance(iso[0], iso[3]) - distance(iso[1], iso[2])) < .01, 'Isosceles trapezoid legs must match');
  const right = await vertices('trapezoid-right');
  assert.equal(right[0][0], right[3][0], 'Right trapezoid must have a vertical leg');
  const arbitrary = await vertices('trapezoid-scalene');
  assert.ok(Math.abs(distance(arbitrary[0], arbitrary[3]) - distance(arbitrary[1], arbitrary[2])) > 1, 'Arbitrary trapezoid should have different legs');
  const rhombus = await vertices('rhombus');
  assert.ok(rhombus.every((p, i) => Math.abs(distance(p, rhombus[(i + 1) % 4]) - distance(rhombus[0], rhombus[1])) < .01), 'Rhombus sides must match');
  const ratio = await paper.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.height / rect.width; });
  assert.ok(Math.abs(ratio - 297 / 210) < .01, 'Page should have portrait A4 proportions');
  await page.getByRole("button", { name: /Отменить/ }).click();
  await expectCount(10);
  await page.getByRole("button", { name: /Повторить/ }).click();
  await expectCount(11);
  await page.getByRole("status").filter({ hasText: "Сохранено в этом браузере" }).waitFor();
  // Wait for the latest drawing to reach storage, not an earlier save status.
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("uliana-whiteboard-v2") ?? "{}").items?.length === 11);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("[data-shape-id]").length === 11);
  await page.getByRole("button", { name: "Ластик", exact: true }).click();
  await paper.evaluate(element => window.scrollTo(0, scrollY + element.getBoundingClientRect().top - 260));
  await paper.locator('[data-shape-type="pen"]').first().click();
  await expectCount(10);
  await page.getByRole("button", { name: /Отменить/ }).click();
  await expectCount(11);
  await page.getByRole("button", { name: "Клетка", exact: true }).click();
  assert.equal(await paper.locator('rect[fill="url(#board-grid-0)"]').count(), 0);
  assert.equal(await page.getByRole('button',{name:'Скачать PNG',exact:true}).count(),0);
  assert.equal(await page.locator('.board-controls select').count(),0);
  assert.equal(await page.getByText('Все листы войдут в PDF',{exact:true}).count(),0);
  const strip=paper.locator('[data-brand-strip]');
  assert.equal(await strip.locator('rect').getAttribute('width'),'80');
  assert.equal(await strip.locator('text').count(),1);
  assert.equal(await strip.locator('[data-brand-handle]').textContent(),'ulianaa.maths');
  assert.equal(await strip.locator('rect').getAttribute('x'),'1600','Brand strip should preserve the old drawing area');
  await mkdir("playwright-report", { recursive: true });
  await page.screenshot({ path: "playwright-report/board-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Очистить", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Очистить доску", exact: true }).click();
  await expectCount(0);
  await page.getByRole("button", { name: /Отменить/ }).click();
  await expectCount(11);

  for (const number of [2, 3]) {
    await page.getByRole('button', { name: 'Ручка', exact: true }).click();
    const sheet = page.locator('.board-paper').nth(number - 1);
    await sheet.evaluate(element => { const r = element.getBoundingClientRect(); window.scrollTo(0, scrollY + r.top - 320); });
    const p = await sheet.evaluate(element => { const point = new DOMPoint(250, 250).matrixTransform(element.getScreenCTM()); return {x:point.x,y:point.y}; });
    await page.mouse.move(p.x,p.y); await page.mouse.down(); await page.mouse.move(p.x+80,p.y+50,{steps:8}); await page.mouse.up();
    await page.waitForFunction(index => document.querySelectorAll('.board-paper')[index].querySelectorAll('[data-shape-id]').length === 1, number - 1);
  }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('uliana-whiteboard-v2')).items.length === 13);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('[data-shape-id]').length === 13);
  assert.deepEqual(await page.locator('.board-paper').evaluateAll(pages => pages.map(p => p.querySelectorAll('[data-shape-id]').length)), [11,1,1]);
  await page.getByRole('button', {name:'+ Добавить лист',exact:true}).click();
  assert.equal(await page.locator('.board-paper').count(),4);
  await page.getByRole('button', {name:/Отменить/}).click();
  await page.waitForFunction(() => document.querySelectorAll('.board-paper').length === 3);
  const pdfDownloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name:'Скачать конспект PDF',exact:true }).click();
  const pdfDownload = await pdfDownloadEvent;
  await pdfDownload.saveAs('.local/whiteboard-notes.pdf');
  const pdfBytes = await readFile(await pdfDownload.path());
  assert.equal(pdfBytes.subarray(0,5).toString(),'%PDF-');
  assert.equal((pdfBytes.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length,3,'PDF must contain all three pages');

  const mobile = await browser.newPage({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on("pageerror", error => errors.push(error.message));
  await mobile.goto(`${base}/board`);
  await mobile.locator(".board-paper").first().waitFor();
  const area = await mobile.locator(".board-paper").first().boundingBox();
  await mobile.touchscreen.tap(area.x + area.width / 2, area.y + area.height / 2);
  await mobile.waitForFunction(() => document.querySelectorAll("[data-shape-id]").length === 1);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Mobile layout should fit the screen");
  await mobile.screenshot({ path: "playwright-report/board-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("Whiteboard checks passed: menu, pen, all nine figures and their geometry, A4 page, eraser, undo/redo, persistence, clear, branded three-page PDF export, adding pages, persistence on all pages and mobile touch.");
} finally { await browser.close(); }
