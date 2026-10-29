import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=path.resolve('assets');
const data=await fs.readFile('src/data.ts','utf8');
const sources=[...new Set([...data.matchAll(/assets\/([^"']+)\.(?:png|webp)/g)].map(match=>match[1]+'.png'))];
const report=[];
for(const name of sources){
  const input=path.join(root,name),output=input.replace(/\.png$/,'.webp');
  const metadata=await sharp(input).metadata();
  await sharp(input).webp({quality:88,alphaQuality:100,effort:6}).toFile(output);
  const [before,after]=await Promise.all([fs.stat(input),fs.stat(output)]);
  report.push({source:name,output:name.replace(/\.png$/,'.webp'),width:metadata.width,height:metadata.height,beforeBytes:before.size,afterBytes:after.size});
}
await fs.mkdir('qa-evidence/structure',{recursive:true});
await fs.writeFile('qa-evidence/structure/images.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:report.reduce((a,x)=>a+x.beforeBytes,0),after:report.reduce((a,x)=>a+x.afterBytes,0)}));
