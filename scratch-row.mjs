import fs from 'node:fs';
import sharp from 'sharp';
const S = '/tmp/claude-0/-home-user-neosaniye/06d260fe-0ac4-5b60-a721-2622b642b579/scratchpad';
const name = process.argv[2];
const files = fs.readdirSync(`${S}/op`).filter((f) => f.endsWith('.png')).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
const CW = 216, CH = 384;
const comps = files.map((f, i) => ({input: `${S}/op/${f}`, left: i * CW, top: 0}));
await sharp({create: {width: CW * files.length, height: CH, channels: 3, background: '#000'}})
  .composite(comps).png().toFile(`${S}/${name}.png`);
console.log(`${files.length} -> ${S}/${name}.png`);
