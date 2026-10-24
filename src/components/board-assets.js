import { assetScope,sendAsset,receiveAsset } from "../account/client.js";
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
export async function storeAsset(blob,id=boardId(),localOnly=false,owner=assetScope()) {
  const key=owner?`cloud:${owner}:${id}`:id;
  if(!localOnly)await sendAsset(id,blob,owner);
  // Store bytes rather than Blob/File objects: Safari can abort Blob transactions.
  const value={data:await blob.arrayBuffer(),type:blob.type};
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{const tx=db.transaction("assets","readwrite");tx.objectStore("assets").put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error??new Error("Не удалось сохранить файл в браузере."));tx.onabort=()=>reject(tx.error??new Error("Не удалось сохранить файл в браузере."));});
  return id;
}
export async function readAsset(id,owner=assetScope()) {
  const key=owner?`cloud:${owner}:${id}`:id;
  const db=await openDatabase();
  const local=await new Promise((resolve,reject)=>{const request=db.transaction("assets").objectStore("assets").get(key);request.onsuccess=()=>{const value=request.result;resolve(value instanceof Blob ? value : value?.data ? new Blob([value.data],{type:value.type}) : null);};request.onerror=()=>reject(request.error);});
  if(local)return local;
  const remote=await receiveAsset(id,owner);if(remote)await storeAsset(remote,id,true,owner);return remote;
}
export function blobDataUrl(blob) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
}
export async function downloadAsset(id,name) {
  const blob=await readAsset(id);if(!blob)throw new Error("Файл не найден в этом браузере.");
  const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function clearPrivateAssets(){
 const db=await openDatabase();
 await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite'),request=tx.objectStore('assets').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(typeof cursor.key==='string'&&cursor.key.startsWith('cloud:'))cursor.delete();cursor.continue();};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
