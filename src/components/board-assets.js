import { boardId } from "./board-id.js";
let database;
function openDatabase() {
  return database ??= new Promise((resolve,reject)=>{
    const request=indexedDB.open("uliana-board-files",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("assets");
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{database=null;reject(request.error);};
  });
}
export async function storeAsset(blob,id=boardId()) {
  // Store bytes rather than Blob/File objects: Safari can abort Blob transactions.
  const value={data:await blob.arrayBuffer(),type:blob.type};
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{const tx=db.transaction("assets","readwrite");tx.objectStore("assets").put(value,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error??new Error("Не удалось сохранить файл в браузере."));tx.onabort=()=>reject(tx.error??new Error("Не удалось сохранить файл в браузере."));});
  return id;
}
export async function readAsset(id) {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{const request=db.transaction("assets").objectStore("assets").get(id);request.onsuccess=()=>{const value=request.result;resolve(value instanceof Blob ? value : value?.data ? new Blob([value.data],{type:value.type}) : null);};request.onerror=()=>reject(request.error);});
}
export function blobDataUrl(blob) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
}
export async function downloadAsset(id,name) {
  const blob=await readAsset(id);if(!blob)throw new Error("Файл не найден в этом браузере.");
  const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
