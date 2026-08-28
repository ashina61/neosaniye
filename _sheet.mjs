import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
const SP='/tmp/claude-0/-home-user-neosaniye/06d260fe-0ac4-5b60-a721-2622b642b579/scratchpad';
const [,, g, per, list, dir, cols] = process.argv;
const lines=(await readFile(`${SP}/${list}`,'utf8')).trim().split('\n').map(l=>l.split(' ')[0]);
const W=280,H=498,COLS=Number(cols??5),PAD=7;
const slice=lines.slice(Number(g)*Number(per), Number(g)*Number(per)+Number(per));
if(!slice.length){console.log('empty');process.exit(0);}
const rows=Math.ceil(slice.length/COLS), comp=[];
for(const [i,n] of slice.entries()){const c=i%COLS,r=Math.floor(i/COLS);
 comp.push({input: await sharp(`${SP}/${dir}/${n}.png`).resize(W,H,{fit:'cover'}).png().toBuffer(), left:PAD+c*(W+PAD), top:PAD+r*(H+PAD)});}
await sharp({create:{width:COLS*(W+PAD)+PAD,height:rows*(H+PAD)+PAD,channels:3,background:'#2a2a2a'}}).composite(comp).png().toFile(`${SP}/sheets/${dir}-${g}.png`);
console.log(`${dir}-${g} ok`);
