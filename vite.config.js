import { accountsApi } from "./scripts/vite-accounts.mjs";
import { pdfAssets } from "./scripts/vite-pdf-assets.mjs";
import { defineConfig,loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({mode})=>{
  Object.assign(process.env,loadEnv(mode,process.cwd(),""));
  return {plugins: [react(), tailwindcss(), pdfAssets(), accountsApi()]};
});
