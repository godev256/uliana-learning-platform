// Embed raster clipboard images so the notebook and PDF need no external files.
export const validBoardImage = source => typeof source === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(source);
export async function clipboardImage(file) {
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
    const ratio=Math.min(1,2000/image.naturalWidth,2400/image.naturalHeight);
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
    canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
    return {src:canvas.toDataURL("image/webp",.86),width:canvas.width,height:canvas.height};
  } finally {URL.revokeObjectURL(url);}
}
