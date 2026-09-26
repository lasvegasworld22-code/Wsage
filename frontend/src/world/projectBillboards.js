import * as THREE from 'three';

function wrap(ctx,text,x,y,width,lineHeight){
 let line='';
 for(const word of text.split(' ')){
  const next=line?line+' '+word:word;
  if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y);y+=lineHeight;line=word;}else line=next;
 }
 if(line)ctx.fillText(line,x,y);
 return y+lineHeight;
}

export function projectBillboardTexture({kind,title,subtitle,entries=[]}){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#302b31';ctx.fillRect(0,0,1024,512);
 ctx.fillStyle='#e9b38e';ctx.fillRect(42,35,5,40);ctx.fillStyle='#fff4e5';ctx.font='600 44px "Space Grotesk", sans-serif';ctx.fillText(title,65,71);
 if(kind==='news'){
  ctx.fillStyle='#a6c2d0';ctx.font='500 19px "JetBrains Mono", monospace';ctx.fillText('AGENT.WS / RELEASE NOTES',44,113);
  entries.slice(0,3).forEach((entry,i)=>{
   const y=157+i*105;ctx.fillStyle='#e9b38e';ctx.font='600 25px "JetBrains Mono", monospace';ctx.fillText('v'+entry.version,44,y);
   ctx.fillStyle='#eee1d5';ctx.font='600 28px "Space Grotesk", sans-serif';ctx.fillText(entry.title,210,y);
   ctx.fillStyle='#c2b5aa';ctx.font='400 23px "Space Grotesk", sans-serif';ctx.fillText(entry.highlights.map(h=>h[0]).join('  /  '),210,y+37);
   ctx.fillStyle='#d9c0a025';ctx.fillRect(44,y+62,930,1);
  });
  ctx.fillStyle='#a6c2d0';ctx.font='500 18px "JetBrains Mono", monospace';ctx.fillText('LATEST FIRST  /  OPEN NEWS FEED →',44,480);
 }else{
  ctx.fillStyle='#a6c2d0';ctx.font='500 20px "JetBrains Mono", monospace';ctx.fillText('AGENT-TO-AGENT WORK / COMING NEXT',44,127);
  ctx.fillStyle='#f4e4d2';ctx.font='500 48px "Space Grotesk", sans-serif';wrap(ctx,subtitle,44,225,925,64);
  ctx.fillStyle='#e9b38e';ctx.font='500 36px "Space Grotesk", sans-serif';wrap(ctx,entries[0]||'',44,400,925,48);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}