import {storeAsset} from './board-assets.js';
import {pdfPageCount,pdfPageImage} from './board-pdf.js';
import {boardId} from './board-id.js';

export async function preparePdfTopic(file,onProgress=()=>{},pageLimit=100){
 if(!/\.pdf$/i.test(file.name)||await file.slice(0,5).text()!=='%PDF-')throw new Error('Выберите PDF-файл.');
 if(file.size>20*1024*1024)throw new Error('PDF должен быть не больше 20 МБ.');
 onProgress('Загружаем PDF…');
 const assetId=await storeAsset(new Blob([file],{type:'application/pdf'})),pageCount=await pdfPageCount(assetId);
 if(pageCount<1||pageCount>100)throw new Error('В PDF должно быть от 1 до 100 страниц.');
 if(pageCount>pageLimit)throw new Error('На доске может быть до 100 листов. В этом PDF слишком много страниц для текущей доски.');
 const pages=[];
 for(let number=1;number<=pageCount;number++){onProgress(`Подготавливаем страницу ${number} из ${pageCount}…`);pages.push(await pdfPageImage(assetId,number));}
 const document={assetId,name:file.name.slice(0,512),pageCount,pages};
 return {document,notebook:pdfTopicNotebook(document)};
}
export function pdfTopicNotebook(document){
 return {pageCount:document.pageCount,items:document.pages.map((image,index)=>{
  const ratio=Math.min(1600/image.width,2376/image.height),width=image.width*ratio,height=image.height*ratio;
  return {id:boardId(),type:'image',page:index,color:'#212123',size:4,assetId:image.assetId,background:true,documentId:document.assetId,sourcePage:index+1,points:[[(1600-width)/2,0],[(1600+width)/2,height]]};
 })};
}
