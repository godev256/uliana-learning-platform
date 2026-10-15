import { readAsset,storeAsset } from "./board-assets.js";
let library;
const documents=new Map(),renders=new Map();
async function pdfLibrary() {
  return library ??= (async()=>{
    const [pdfjs,worker]=await Promise.all([import("pdfjs-dist"),import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
    pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
    return pdfjs;
  })();
}
async function documentFor(id) {
  if(!documents.has(id)) {
    const promise=(async()=>{
      const blob=await readAsset(id);if(!blob)throw new Error("Файл не найден в этом браузере.");
      const pdfjs=await pdfLibrary();
      return pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,cMapUrl:"/pdf-assets/cmaps/",cMapPacked:true,standardFontDataUrl:"/pdf-assets/standard_fonts/",wasmUrl:"/pdf-assets/wasm/",iccUrl:"/pdf-assets/iccs/"}).promise;
    })();
    documents.set(id,promise);promise.catch(()=>documents.delete(id));
    if(documents.size>3){const oldest=documents.keys().next().value;const doc=documents.get(oldest);documents.delete(oldest);void doc.then(value=>value.destroy()).catch(()=>{});}
  }
  return documents.get(id);
}
export async function pdfPageCount(id) {return (await documentFor(id)).numPages;}
export async function pdfPageImage(id,number) {
  const assetId=`${id}:page:${number}`;
  if(!renders.has(assetId)) {
    const promise=(async()=>{
      const document=await documentFor(id),page=await document.getPage(number),natural=page.getViewport({scale:1});
      const scale=Math.min(2.5,1800/Math.max(natural.width,natural.height)),viewport=page.getViewport({scale});
      if(!await readAsset(assetId)) {
        const canvas=window.document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext("2d"),viewport,background:"white"}).promise;
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Не удалось отобразить страницу.")),"image/webp",.9));
        await storeAsset(blob,assetId);canvas.width=0;canvas.height=0;page.cleanup();
      }
      return {assetId,width:viewport.width,height:viewport.height};
    })();
    renders.set(assetId,promise);promise.catch(()=>renders.delete(assetId));
  }
  return renders.get(assetId);
}
