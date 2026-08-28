import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
const SP='/tmp/claude-0/-home-user-neosaniye/06d260fe-0ac4-5b60-a721-2622b642b579/scratchpad';
const list = process.argv[4] ?? 'shots2.txt';
const dir  = process.argv[5] ?? 'v2';
const lines = (await readFile(`${SP}/${list}`,'utf8')).trim().split('\n').map(l=>l.split(' ')[0]);
const W=300, H=533, COLS=4, PAD=8;
const per = Number(process.argv[3] ?? 16);
const group = Number(process.argv[2]);
const slice = lines.slice(group*per, group*per+per);
if(!slice.length){console.log('empty');process.exit(0);}
const rows = Math.ceil(slice.length/COLS);
const comp = [];
for (const [i,name] of slice.entries()){
  const c=i%COLS, r=Math.floor(i/COLS);
  comp.push({input: await sharp(`${SP}/${dir}/${name}.png`).resize(W,H,{fit:'cover'}).png().toBuffer(), left: PAD+c*(W+PAD), top: PAD+r*(H+PAD)});
}
await sharp({create:{width:COLS*(W+PAD)+PAD,height:rows*(H+PAD)+PAD,channels:3,background:'#2a2a2a'}}).composite(comp).png().toFile(`${SP}/sheets/${dir}-${group}.png`);
console.log(`${dir}-${group}:`, slice.join(' | '));
