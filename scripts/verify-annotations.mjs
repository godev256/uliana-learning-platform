import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("uliana-whiteboard-v2", JSON.stringify({ pageCount: 3, items: [
        { id: "cube-for-annotation", page: 0, type: "cube", color: "#212123", size: 4, points: [[200, 1000], [650, 1450]] },
        { id: "pyramid-for-annotation", page: 1, type: "pyramid", color: "#212123", size: 4, points: [[200, 600], [800, 1200]] },
      ] }));
    });
    await page.goto(new URL("/board", process.env.PLAYWRIGHT_URL ?? "http://127.0.0.1:5173").href);
    for (const [index, id] of ["cube-for-annotation", "pyramid-for-annotation"].entries()) {
      const paper = page.locator(".board-paper").nth(index);
      const figure = paper.locator(`[data-shape-id="${id}"]`);
      await figure.evaluate(element => {
        const box = element.getBoundingClientRect();
        const controls = document.querySelector(".board-controls").getBoundingClientRect();
        window.scrollTo(0, scrollY + box.top - controls.height - 50);
      });
      await page.getByRole("button", { name: "Ручка", exact: true }).click();
      await page.getByRole("button", { name: "Синий", exact: true }).click();
      const box = await figure.boundingBox();
      // Place an annotation directly over the wireframe, using the visible figure bounds.
      const target = { x: box.x + box.width * .75, y: box.y + box.height * .55 };
      await page.mouse.click(target.x, target.y);
      await page.waitForFunction(pageIndex => document.querySelectorAll(".board-paper")[pageIndex].querySelectorAll('[data-shape-type="pen"]').length === 1, index);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const dot = paper.locator('[data-shape-type="pen"]');
      const dotBounds = await dot.boundingBox();
      assert.ok(Math.abs(dotBounds.x + dotBounds.width / 2 - target.x) < 1, `Dot should match pointer X at width ${viewport.width}, page ${index + 1}`);
      assert.ok(Math.abs(dotBounds.y + dotBounds.height / 2 - target.y) < 1, `Dot should match pointer Y after scrolling at width ${viewport.width}, page ${index + 1}`);
      assert.equal(await dot.getAttribute("stroke"), "#3058a0");
      assert.equal(await paper.locator("[data-shape-id]").last().getAttribute("data-shape-type"), "pen", "Annotation should render above the solid");

      await page.getByRole("button", { name: "Линия", exact: true }).click();
      await page.getByRole("button", { name: "Красный", exact: true }).click();
      const current = await figure.boundingBox();
      const from = { x: current.x + current.width * .15, y: current.y + current.height * .65 };
      const to = { x: current.x + current.width * .9, y: current.y + current.height * .3 };
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up();
      await page.waitForFunction(pageIndex => document.querySelectorAll(".board-paper")[pageIndex].querySelectorAll('[data-shape-type="line"]').length === 1, index);
      const section = paper.locator('[data-shape-type="line"]');
      const ends = await section.evaluate(element => {
        const matrix = element.ownerSVGElement.getScreenCTM();
        return [new DOMPoint(element.x1.baseVal.value, element.y1.baseVal.value).matrixTransform(matrix), new DOMPoint(element.x2.baseVal.value, element.y2.baseVal.value).matrixTransform(matrix)].map(p => ({ x: p.x, y: p.y }));
      });
      assert.ok(Math.hypot(ends[0].x - from.x, ends[0].y - from.y) < 1);
      assert.ok(Math.hypot(ends[1].x - to.x, ends[1].y - to.y) < 1, "Section endpoint should match the pointer");
      await page.screenshot({ path: `playwright-report/annotations-${viewport.width}-page-${index + 1}.png` });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Annotation checks passed: dots and section lines match the pointer and render above 3D figures on two pages, at desktop and mobile sizes.");
} finally { await browser.close(); }
