/**
 * Генерирует адаптивные версии портрета из repetitor.png и скриншотов отзывов
 * из reviews/ в public/.
 * Запуск: node scripts/build-images.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "repetitor.png");
const outDir = resolve(root, "public");

mkdirSync(outDir, { recursive: true });

const widths = [640, 960, 1254];

for (const width of widths) {
  const base = sharp(source).resize({ width, withoutEnlargement: true });

  await base.clone().avif({ quality: 62 }).toFile(`${outDir}/hero-${width}.avif`);
  await base.clone().webp({ quality: 78 }).toFile(`${outDir}/hero-${width}.webp`);
  await base.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(`${outDir}/hero-${width}.jpg`);
}

// Превью ссылки в мессенджерах: 1200x630, портрет слева.
await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 3,
    background: "#fbfaf6",
  },
})
  .composite([
    {
      input: await sharp(source).resize({ width: 630, height: 630, fit: "cover", position: "top" }).toBuffer(),
      left: 0,
      top: 0,
    },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(`${outDir}/og.jpg`);

/**
 * Скриншоты отзывов. Это текст на картинке, поэтому качество выше, чем у портрета:
 * на пережатом avif буквы плывут, а скриншот нужен читаемым при открытии целиком.
 */
const reviewsOutDir = resolve(outDir, "reviews");
mkdirSync(reviewsOutDir, { recursive: true });

// Вторая ширина в каждой паре — нативная ширина скриншота: апскейл не нужен,
// а имя файла должно совпадать с реальным w-дескриптором в srcSet.
const reviewShots = [
  { source: "reviews/otzyv-1-chat.png", name: "otzyv-1-chat", widths: [640, 1066] },
  { source: "reviews/otzyv-1-result.png", name: "otzyv-1-result", widths: [640, 1206] },
  { source: "reviews/otzyv-2-chat-1.png", name: "otzyv-2-chat-1", widths: [640, 977] },
  { source: "reviews/otzyv-2-chat-2.png", name: "otzyv-2-chat-2", widths: [640, 968] },
  { source: "reviews/otzyv-4-chat.png", name: "otzyv-4-chat", widths: [640, 953] },
  { source: "reviews/otzyv-5-chat.png", name: "otzyv-5-chat", widths: [640, 1081] },
  { source: "reviews/otzyv-6-chat.jpg", name: "otzyv-6-chat", widths: [640, 1099] },
  { source: "reviews/otzyv-7-chat.jpg", name: "otzyv-7-chat", widths: [640, 775] },
];

for (const shot of reviewShots) {
  for (const width of shot.widths) {
    const base = sharp(resolve(root, shot.source)).resize({
      width,
      withoutEnlargement: true,
    });

    await base
      .clone()
      .avif({ quality: 72 })
      .toFile(`${reviewsOutDir}/${shot.name}-${width}.avif`);
    await base
      .clone()
      .webp({ quality: 86 })
      .toFile(`${reviewsOutDir}/${shot.name}-${width}.webp`);
    await base
      .clone()
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(`${reviewsOutDir}/${shot.name}-${width}.jpg`);
  }
}

console.log("Готово:", outDir);
