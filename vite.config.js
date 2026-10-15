import { pdfAssets } from "./scripts/vite-pdf-assets.mjs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), pdfAssets()],
});
