const same=(a,b)=>a===b||JSON.stringify(a)===JSON.stringify(b);
export function notebookPatch(base,next){
 const before=new Map(base.items.map(item=>[item.id,item])),after=new Set(next.items.map(item=>item.id));
 const upsert=next.items.filter(item=>!same(before.get(item.id),item)),remove=base.items.filter(item=>!after.has(item.id)).map(item=>item.id);
 const natural=[...base.items.filter(item=>after.has(item.id)).map(item=>item.id),...next.items.filter(item=>!before.has(item.id)).map(item=>item.id)],order=next.items.map(item=>item.id);
 return {pageCount:next.pageCount,upsert,remove,...(same(natural,order)?{}:{order})};
}
export function applyNotebookPatch(base,patch){
 if(!patch||!Array.isArray(patch.upsert)||!Array.isArray(patch.remove)||!Number.isInteger(patch.pageCount)||patch.pageCount<1||patch.pageCount>100)throw new Error('Некорректное изменение доски.');
 const rows=new Map(base.items.map(item=>[item.id,item])),upsertIds=new Set();
 for(const id of patch.remove){if(typeof id!=='string')throw new Error('Некорректное удаление.');rows.delete(id);}
 for(const item of patch.upsert){if(!item||typeof item.id!=='string'||upsertIds.has(item.id)||patch.remove.includes(item.id))throw new Error('Некорректный объект.');upsertIds.add(item.id);rows.set(item.id,item);}
 const order=patch.order??[...rows.keys()];
 if(!Array.isArray(order)||order.length!==rows.size||new Set(order).size!==order.length||order.some(id=>!rows.has(id)))throw new Error('Некорректный порядок доски.');
 return {pageCount:patch.pageCount,items:order.map(id=>rows.get(id))};
}
