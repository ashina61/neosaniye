import path from 'node:path';
import {copyFile, mkdir, stat, writeFile} from 'node:fs/promises';

const SR = 44100;

function clamp(value, low = -1, high = 1) { return Math.max(low, Math.min(high, value)); }
function seedHash(value) { let h = 2166136261; for (const ch of String(value || 'neosaniye')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function random(seed) { let state = seed >>> 0; return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function wavBuffer(seconds, channels, sampleFn) {
  const frames = Math.ceil(seconds * SR); const bytesPerFrame = channels * 2; const dataBytes = frames * bytesPerFrame;
  const buffer = Buffer.alloc(44 + dataBytes); buffer.write('RIFF',0); buffer.writeUInt32LE(36+dataBytes,4); buffer.write('WAVE',8); buffer.write('fmt ',12); buffer.writeUInt32LE(16,16); buffer.writeUInt16LE(1,20); buffer.writeUInt16LE(channels,22); buffer.writeUInt32LE(SR,24); buffer.writeUInt32LE(SR*bytesPerFrame,28); buffer.writeUInt16LE(bytesPerFrame,32); buffer.writeUInt16LE(16,34); buffer.write('data',36); buffer.writeUInt32LE(dataBytes,40);
  let offset=44; for(let i=0;i<frames;i+=1){const t=i/SR;const values=sampleFn(t,seconds);for(let channel=0;channel<channels;channel+=1){const value=Array.isArray(values)?values[channel]:values;buffer.writeInt16LE(Math.round(clamp(value)*32767),offset);offset+=2;}} return buffer;
}

function smoothedNoise(seed) { const rnd=random(seed); const points=Array.from({length:16386},()=>rnd()*2-1); return (t,speed=1)=>{const position=(t*speed)%16384;const index=Math.floor(position);let fraction=position-index;fraction=fraction*fraction*(3-2*fraction);return points[index]+(points[index+1]-points[index])*fraction;}; }
async function writeEffect(outDir,name,seconds,sampleFn){const filePath=path.join(outDir,`${name}.wav`);await writeFile(filePath,wavBuffer(seconds,1,sampleFn));return filePath;}
async function exists(filePath){const info=await stat(filePath).catch(()=>null);return Boolean(info?.isFile()&&info.size>0);}

const REFERENCE_NAMES = {
  'whoosh-entrance': 'whoosh-entrance.wav',
  'whoosh-long': 'whoosh-long.wav',
  'whoosh-pan': 'whoosh-pan.wav',
  'camera-shutter': 'camera-shutter.wav',
  'focus-hunt': 'focus-hunt.wav',
  paper: 'paper.wav', stamp: 'stamp.wav', cash: 'cash.wav', coin: 'coin.wav',
  impact: 'impact.wav', heartbeat: 'heartbeat.wav', 'neon-buzz': 'neon-buzz.wav', 'final-boom': 'final-boom.wav',
};

export async function makeRemotionSfxPack({outDir, publicPrefix, seed='neosaniye', referenceDir=process.env.REMOTION_SFX_REFERENCE_DIR || 'assets/sfx/premium'}={}) {
  if(!outDir||!publicPrefix) throw new Error('REMOTION_SFX_OUTPUT_REQUIRED');
  await mkdir(outDir,{recursive:true}); const base=seedHash(seed); const n1=smoothedNoise(base+11); const n2=smoothedNoise(base+29);
  const definitions={
    'whoosh-entrance':[1.25,(t,d)=>n1(t,150)*Math.sin(Math.PI*t/d)**1.8*.58],
    'whoosh-long':[2.1,(t,d)=>(n1(t,85)+Math.sin(2*Math.PI*(95+260*t)*t)*.22)*Math.sin(Math.PI*t/d)**1.55*.5],
    'whoosh-pan':[.85,(t,d)=>n2(t,220)*Math.sin(Math.PI*t/d)**2*.62],
    'camera-shutter':[.65,(t)=>n2(t,620)*Math.exp(-31*t)*.72+Math.sin(2*Math.PI*115*t)*Math.exp(-20*t)*.32],
    'focus-hunt':[1.45,(t,d)=>Math.sin(2*Math.PI*(170+760*t/d)*t)*Math.sin(Math.PI*t/d)**2*.27+n1(t,35)*.06],
    paper:[1.55,(t,d)=>(n1(t,250)*.28+n2(t,53)*.18)*Math.sin(Math.PI*t/d)**.65],
    stamp:[.75,(t)=>Math.sin(2*Math.PI*62*t)*Math.exp(-9*t)*.82+n1(t,290)*Math.exp(-19*t)*.42],
    cash:[1.55,(t)=>(Math.sin(2*Math.PI*1420*t)+.55*Math.sin(2*Math.PI*2030*t))*Math.exp(-4*t)*.25+n2(t,190)*Math.exp(-4.5*t)*.09],
    coin:[1.1,(t)=>(Math.sin(2*Math.PI*1510*t)+.62*Math.sin(2*Math.PI*2260*t))*Math.exp(-4.8*t)*.34],
    impact:[1.25,(t)=>Math.sin(2*Math.PI*(74-25*t)*t)*Math.exp(-4.2*t)*.86+n1(t,90)*Math.exp(-13*t)*.34],
    heartbeat:[2.6,(t)=>{const phase=t%1.02;const first=phase<.24?Math.sin(2*Math.PI*54*phase)*Math.exp(-24*phase):0;const secondPhase=phase-.18;const second=secondPhase>=0&&secondPhase<.2?Math.sin(2*Math.PI*47*secondPhase)*Math.exp(-28*secondPhase):0;return first*.62+second*.38;}],
    'neon-buzz':[2.4,(t,d)=>(Math.sin(2*Math.PI*(118+5*Math.sin(t*8))*t)*.16+n1(t,900)*.035)*Math.sin(Math.PI*t/d)**.45],
    'final-boom':[1.7,(t)=>Math.sin(2*Math.PI*(47-9*t)*t)*Math.exp(-1.85*t)*.9+Math.sin(2*Math.PI*23*t)*Math.exp(-2.6*t)*.4],
  };
  const library={};
  for(const [family,[seconds,sampleFn]] of Object.entries(definitions)){
    const override=path.resolve(referenceDir,REFERENCE_NAMES[family]||`${family}.wav`); const output=path.join(outDir,`${family}.wav`); let source='procedural-original';
    if(await exists(override)){await copyFile(override,output);source='owned-reference-override';}else{await writeEffect(outDir,family,seconds,sampleFn);}
    library[family]={path:`${publicPrefix}/${family}.wav`,durationInFrames:Math.ceil(seconds*30),volume:family==='heartbeat'?.42:family==='paper'?.48:family==='neon-buzz'?.18:.7,license:source==='owned-reference-override'?'user-owned-or-cleared':'proprietary-original',licenseEvidence:source==='owned-reference-override'?override:'src/audio/makeRemotionSfx.js',source};
  }
  return library;
}
