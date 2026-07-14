import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const url = process.env.PLAYWRIGHT_URL ?? "http://127.0.0.1:5173/";
const screenshotsDir = "playwright-report";

async function launchBrowser() {
  const launchOptions = { headless: true };

  try {
    return await chromium.launch(launchOptions);
  } catch (error) {
    const message = String(error?.message ?? error);

    if (!message.includes("Executable doesn't exist")) {
      throw error;
    }

    throw new Error(
      "Playwright browser binary is missing. Run: npx playwright install chromium",
    );
  }
}

async function inspectPage(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("#method").scrollIntoViewIfNeeded();

  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const about = document.querySelector("#about");
    const method = document.querySelector("#method");
    const cards = [...document.querySelectorAll("#method article")];
    const cardRects = cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });

    const aboutRect = about?.getBoundingClientRect();
    const methodRect = method?.getBoundingClientRect();
    const aboutToMethodGap =
      aboutRect && methodRect ? Math.round(methodRect.top - aboutRect.bottom) : null;

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: root.scrollWidth,
      hasHorizontalOverflow: root.scrollWidth > window.innerWidth + 1,
      cardCount: cards.length,
      cardRects,
      aboutToMethodGap,
      methodText: method?.innerText ?? "",
    };
  });

  await page.screenshot({
    path: `${screenshotsDir}/${viewport.width}x${viewport.height}.png`,
    fullPage: true,
  });

  return result;
}

async function inspectReviews(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("#reviews").scrollIntoViewIfNeeded();
  await page.locator("[data-review-card]").first().waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const card = document.querySelector("[data-review-card]");
    return Boolean(card?.innerText?.trim());
  });

  const readState = async () =>
    page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-review-card]")];
      const visibleCards = cards.filter((card) => {
        const styles = window.getComputedStyle(card);
        const rect = card.getBoundingClientRect();
        return styles.display !== "none" && rect.width > 0 && rect.height > 0;
      });

      return {
        cardCount: cards.length,
        visibleCount: visibleCards.length,
        firstVisibleText: visibleCards[0]?.innerText ?? "",
      };
    });

  const initial = await readState();
  await page.locator("[data-review-next]").click();
  await page.waitForFunction(
    (firstText) => {
      const card = document.querySelector("[data-review-card]");
      return Boolean(card?.innerText?.trim()) && card.innerText !== firstText;
    },
    initial.firstVisibleText,
  );
  const afterNext = await readState();
  await page.locator("[data-review-prev]").click();
  await page.waitForFunction(
    (firstText) => {
      const card = document.querySelector("[data-review-card]");
      return card?.innerText === firstText;
    },
    initial.firstVisibleText,
  );
  const afterPrevious = await readState();
  await page.waitForTimeout(450);

  await page.locator("#reviews").screenshot({
    path: `${screenshotsDir}/reviews.png`,
  });

  return { initial, afterNext, afterPrevious };
}

const consoleMessages = [];
const pageErrors = [];
const ignoredConsoleSnippets = ["net::ERR_CONNECTION_CLOSED"];
const browser = await launchBrowser();
const page = await browser.newPage();

page.on("console", (message) => {
  const text = message.text();

  if (
    ["error", "warning"].includes(message.type()) &&
    !ignoredConsoleSnippets.some((snippet) => text.includes(snippet))
  ) {
    consoleMessages.push(`${message.type()}: ${text}`);
  }
});

page.on("pageerror", (error) => {
  pageErrors.push(String(error?.message ?? error));
});

await mkdir(screenshotsDir, { recursive: true });

const desktop = await inspectPage(page, { width: 1440, height: 1000 });
const wide = await inspectPage(page, { width: 2048, height: 850 });
const mobile = await inspectPage(page, { width: 390, height: 900 });
const reviews = await inspectReviews(page);

await browser.close();

const failures = [];

for (const result of [desktop, wide, mobile]) {
  if (result.hasHorizontalOverflow) {
    failures.push(
      `Horizontal overflow at ${result.viewport.width}px: scrollWidth ${result.scrollWidth}`,
    );
  }

  if (result.cardCount !== 5) {
    failures.push(`Expected 5 method cards, got ${result.cardCount}`);
  }
}

const narrowWideCards = wide.cardRects.filter((rect) => rect.width < 280);
if (narrowWideCards.length > 0) {
  failures.push(
    `Method cards are too narrow at 2048px: ${wide.cardRects
      .map((rect) => rect.width)
      .join(", ")}`,
  );
}

if (desktop.aboutToMethodGap !== null && desktop.aboutToMethodGap > 110) {
  failures.push(`About-to-method gap is still large: ${desktop.aboutToMethodGap}px`);
}

if (reviews.initial.cardCount !== 3 || reviews.initial.visibleCount !== 3) {
  failures.push(
    `Expected 3 visible review cards on desktop, got ${reviews.initial.visibleCount}/${reviews.initial.cardCount}`,
  );
}

if (reviews.initial.firstVisibleText === reviews.afterNext.firstVisibleText) {
  failures.push("Review carousel did not advance after clicking next");
}

if (reviews.initial.firstVisibleText !== reviews.afterPrevious.firstVisibleText) {
  failures.push("Review carousel did not return after clicking previous");
}

if (consoleMessages.length > 0) {
  failures.push(`Console issues: ${consoleMessages.join(" | ")}`);
}

if (pageErrors.length > 0) {
  failures.push(`Page errors: ${pageErrors.join(" | ")}`);
}

const summary = {
  url,
  screenshotsDir,
  desktop,
  wide,
  mobile,
  reviews,
  consoleMessages,
  pageErrors,
  failures,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
