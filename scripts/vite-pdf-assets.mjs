import { readFileSync,readdirSync,existsSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { createRequire } from 'node:module';
const root=dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
const directories=['cmaps','standard_fonts','wasm','iccs'];
export function pdfAssets(){return {
 name:'local-pdf-assets',
 configureServer(server){server.middlewares.use('/pdf-assets',(req,res,next)=>{
  const match=/^\/(cmaps|standard_fonts|wasm|iccs)\/([\w.-]+)$/.exec((req.url??'').split('?')[0]);if(!match)return next();
  const file=resolve(root,match[1],match[2]);if(!existsSync(file))return next();
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.end(readFileSync(file));
 });},
 generateBundle(){for(const directory of directories)for(const name of readdirSync(resolve(root,directory)))this.emitFile({type:'asset',fileName:`pdf-assets/${directory}/${name}`,source:readFileSync(resolve(root,directory,name))});},
};}
