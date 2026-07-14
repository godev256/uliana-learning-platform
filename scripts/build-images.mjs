/**
 * Генерирует адаптивные версии портрета из repetitor.png в public/.
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

console.log("Готово:", outDir);
