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
  await page.waitForTimeout(450);

  const cards = page.locator("[data-review-card]");
  const cardCount = await cards.count();

  // Скриншоты должны реально грузиться: битый путь даёт naturalWidth 0.
  const readBrokenImages = (selector) =>
    page.evaluate(
      (scope) =>
        [...document.querySelectorAll(`${scope} img`)]
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.currentSrc || img.src),
      selector,
    );

  const brokenCardImages = await readBrokenImages("[data-review-active]");

  await page.locator("#reviews").screenshot({
    path: `${screenshotsDir}/reviews.png`,
  });

  // Карусель зациклена: пройдя все отзывы вперёд, возвращаемся к первому.
  // Сравниваем по скриншоту, а не по подписи: подписи у отзывов повторяются.
  const readFirstShot = () =>
    page.locator("[data-review-active] img").first().getAttribute("src");
  const firstShot = await readFirstShot();
  const shotSequence = [firstShot];
  const reviewCount = await page
    .getByRole("button", { name: /^Показать отзыв \d+$/ })
    .count();

  for (let step = 0; step < reviewCount; step += 1) {
    await page.locator("[data-review-next]").click();
    await page.waitForTimeout(200);
    shotSequence.push(await readFirstShot());
    brokenCardImages.push(...await readBrokenImages("[data-review-active]"));
  }

  const loopsForward = shotSequence.at(-1) === firstShot;

  await page.locator("[data-review-prev]").click();
  await page.waitForTimeout(200);
  const goesBackward = (await readFirstShot()) !== firstShot;

  // Проверяем отзыв с результатом ОГЭ независимо от его места в ленте.
  const examReviewIndex = shotSequence.findIndex((src) =>
    src?.includes("otzyv-1-chat"),
  );
  if (examReviewIndex < 0) {
    throw new Error("Review with the OGE exam result is missing");
  }
  await page
    .getByRole("button", { name: `Показать отзыв ${examReviewIndex + 1}`, exact: true })
    .click();
  await page.waitForTimeout(250);

  await page.locator("[data-review-active]").click();
  const lightbox = page.locator('[role="dialog"][aria-modal="true"]');
  await lightbox.waitFor({ state: "visible" });
  await page.waitForTimeout(400);

  // В модалке отзыв и результат экзамена идут вместе — иначе результат нечем подтвердить.
  const lightboxImageCount = await lightbox.locator("img").count();
  const brokenLightboxImages = await readBrokenImages(
    '[role="dialog"][aria-modal="true"]',
  );
  const lightboxHasResultLabel = (await lightbox.innerText()).includes(
    "РЕЗУЛЬТАТ ЭКЗАМЕНА",
  );

  await page.screenshot({ path: `${screenshotsDir}/reviews-lightbox.png` });

  await page.keyboard.press("Escape");
  await lightbox.waitFor({ state: "detached" });
  const lightboxClosed = (await lightbox.count()) === 0;

  return {
    cardCount,
    reviewCount,
    loopsForward,
    goesBackward,
    uniqueShots: [...new Set(shotSequence)].length,
    brokenCardImages,
    lightboxImageCount,
    brokenLightboxImages,
    lightboxHasResultLabel,
    lightboxClosed,
  };
}

async function inspectBookingForm(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("#contact").scrollIntoViewIfNeeded();

  // Сначала заведомо неверные данные: короткое имя и контакт, по которому не ответить.
  await page.fill("#name", "Ан");
  await page.fill("#lead-contact", "89001112");
  await page.selectOption("#grade", "9 класс");
  await page.selectOption("#goal", "ОГЭ");
  await page.check('input[name="consent"]');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(250);

  const validation = {
    modalOpenedOnInvalid:
      (await page.locator("[data-booking-modal]").count()) > 0,
    errors: await page.locator(".field-error").allInnerTexts(),
  };

  // Телефон в свободной записи и валидный ник тоже должны проходить.
  await page.fill("#name", "Анна");
  await page.fill("#lead-contact", "+7 (900) 000-00-00");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(250);
  const phoneAccepted = (await page.locator("[data-booking-modal]").count()) > 0;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  await page.fill("#lead-contact", "@anna");
  await page.click('button[type="submit"]');

  const modal = page.locator("[data-booking-modal]");
  await modal.waitFor({ state: "visible" });
  await page.waitForTimeout(350);

  const message = await page.locator("[data-booking-message]").innerText();

  // Копирование — единственный способ донести шаблон до чата, проверяем, что оно работает.
  await modal.getByRole("button", { name: /СКОПИРОВАТЬ ТЕКСТ/ }).click();
  await page.waitForTimeout(300);
  const copyNote = await modal.locator('[aria-live="polite"]').innerText();
  const channelLabels = await modal
    .locator("button.pill-link")
    .allInnerTexts();

  await page.screenshot({ path: `${screenshotsDir}/booking-modal.png` });

  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "detached" });

  return {
    validation,
    phoneAccepted,
    message,
    copyNote,
    channelLabels: channelLabels.map((label) => label.trim()),
    closedOnEscape: (await modal.count()) === 0,
  };
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
const booking = await inspectBookingForm(page);

await browser.close();

const failures = [];

for (const result of [desktop, wide, mobile]) {
  if (result.hasHorizontalOverflow) {
    failures.push(
      `Horizontal overflow at ${result.viewport.width}px: scrollWidth ${result.scrollWidth}`,
    );
  }

  if (result.cardCount !== 6) {
    failures.push(`Expected 6 method cards, got ${result.cardCount}`);
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

if (reviews.cardCount < 1) {
  failures.push("Reviews section renders no review card");
}

if (reviews.brokenCardImages.length > 0) {
  failures.push(
    `Review screenshots failed to load: ${reviews.brokenCardImages.join(", ")}`,
  );
}

if (!reviews.loopsForward) {
  failures.push("Review carousel did not loop back to the first review");
}

if (!reviews.goesBackward) {
  failures.push("Review carousel did not move back on the previous button");
}

if (reviews.uniqueShots !== reviews.reviewCount) {
  failures.push(
    `Carousel showed only ${reviews.uniqueShots} distinct reviews while cycling`,
  );
}

if (reviews.lightboxImageCount < 2) {
  failures.push(
    `Expected message + exam result in the lightbox, got ${reviews.lightboxImageCount} image(s)`,
  );
}

if (!reviews.lightboxHasResultLabel) {
  failures.push("Lightbox is missing the exam result block");
}

if (reviews.brokenLightboxImages.length > 0) {
  failures.push(
    `Lightbox screenshots failed to load: ${reviews.brokenLightboxImages.join(", ")}`,
  );
}

if (!reviews.lightboxClosed) {
  failures.push("Review lightbox did not close on Escape");
}

// Шаблон заявки должен нести все четыре поля формы — иначе Ульяне нечего сопоставить.
for (const fragment of ["Анна", "@anna", "9 класс", "ОГЭ"]) {
  if (!booking.message.includes(fragment)) {
    failures.push(`Booking message is missing "${fragment}": ${booking.message}`);
  }
}

if (booking.channelLabels.length !== 2) {
  failures.push(
    `Expected Telegram and VK buttons, got: ${booking.channelLabels.join(", ")}`,
  );
}

if (booking.validation.modalOpenedOnInvalid) {
  failures.push("Booking modal opened with an invalid name and phone");
}

if (booking.validation.errors.length !== 2) {
  failures.push(
    `Expected name and contact errors, got: ${booking.validation.errors.join(" | ")}`,
  );
}

if (!booking.phoneAccepted) {
  failures.push("A valid phone number was rejected");
}

if (!booking.copyNote.includes("скопирован")) {
  failures.push(`Copy button did not report success: ${booking.copyNote}`);
}

if (!booking.closedOnEscape) {
  failures.push("Booking modal did not close on Escape");
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
  booking,
  consoleMessages,
  pageErrors,
  failures,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
