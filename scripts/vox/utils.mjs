import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

export const stages = ['research','script','voice','beats','visuals','images','captions','audio','render','qc'];
export const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
export const writeJson = async (file, value) => { await mkdir(path.dirname(file), {recursive:true}); await writeFile(file, `${JSON.stringify(value,null,2)}\n`); };
export const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const words = (text) => text.trim().split(/\s+/u).filter(Boolean);
export const slugify = (value) => value.toLocaleLowerCase('tr').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64);
export const seeded = (seed) => {let state=(Number(seed)>>>0)||1; return () => ((state=Math.imul(1664525,state)+1013904223>>>0)/4294967296);};
export function parseArgs(argv) {
  const out={duration:40,language:'tr',seed:1868,resume:false,force:false,dryRun:false,noUpload:true};
  const booleans=new Set(['resume','force','dry-run','no-upload']);
  for(let i=0;i<argv.length;i++){const token=argv[i]; if(!token.startsWith('--')) throw new Error(`Bilinmeyen argüman: ${token}`); const key=token.slice(2); if(booleans.has(key)){out[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=true;} else {const value=argv[++i]; if(!value||value.startsWith('--')) throw new Error(`--${key} bir değer gerektirir.`); out[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;}}
  out.duration=Number(out.duration); out.seed=Number(out.seed);
  if(!Number.isFinite(out.duration)||out.duration<35||out.duration>45) throw new Error('--duration 35 ile 45 arasında olmalıdır.');
  if(out.upload===true||out.noUpload===false) throw new Error('Upload VOX modunda etkin değildir.');
  if(!out.topic&&!out.project) throw new Error('--topic veya --project gereklidir.');
  if(out.from&&!stages.includes(out.from)) throw new Error(`Geçersiz --from: ${out.from}`);
  if(out.only&&!stages.includes(out.only)) throw new Error(`Geçersiz --only: ${out.only}`);
  return out;
}
export function selectedStages(options){if(options.only)return [options.only]; const start=options.from?stages.indexOf(options.from):0; return stages.slice(start);}
