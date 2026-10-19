import { accountsApi } from "./scripts/vite-accounts.mjs";
import { pdfAssets } from "./scripts/vite-pdf-assets.mjs";
import { defineConfig,loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({mode})=>{
  Object.assign(process.env,loadEnv(mode,process.cwd(),""));
  const goAPI=process.env.GO_API_URL;
  return {
    plugins: [react(), tailwindcss(), pdfAssets(), ...(!goAPI?[accountsApi()]:[])],
    server: goAPI ? {proxy:{'/api':{target:goAPI,changeOrigin:false}}} : undefined,
  };
});
