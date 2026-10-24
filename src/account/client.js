export async function accountRequest(action,data,params={},options={}){
 const query=new URLSearchParams({action,...params});
 const response=await fetch(`/api/account?${query}`,{signal:options.signal,keepalive:options.keepalive,method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const result=await response.json().catch(()=>({error:'Кабинет временно недоступен.'}));
 if(!response.ok)throw Object.assign(new Error(result.error||'Не удалось выполнить действие.'),{status:response.status});return result;
}
let boardOwner=null;
export function setBoardOwner(id){boardOwner=id;}
export function assetScope(){return boardOwner;}
const bytesToBase64=bytes=>{let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);};
export async function sendAsset(id,blob,owner=boardOwner){
 if(!owner)return;
 const bytes=new Uint8Array(await blob.arrayBuffer()),size=240000,total=Math.max(1,Math.ceil(bytes.length/size));
 if(total>200)throw new Error('Файл слишком большой для кабинета.');
 for(let part=0;part<total;part++)await accountRequest('asset',{studentId:owner,assetId:id,part,total,mime:blob.type,data:bytesToBase64(bytes.subarray(part*size,(part+1)*size))});
}
export async function receiveAsset(id,owner=boardOwner){
 if(!owner)return null;
 let first;try{first=await accountRequest('asset',undefined,{studentId:owner,assetId:id,part:'0'});}catch(error){if(error.status===404)return null;throw error;}
 const chunks=new Array(first.total);
 let next=0;await Promise.all(Array.from({length:Math.min(3,first.total)},async()=>{while(next<first.total){const i=next++,result=i===0?first:await accountRequest('asset',undefined,{studentId:owner,assetId:id,part:String(i)});chunks[i]=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0));}}));
 return new Blob(chunks,{type:first.mime});
}
