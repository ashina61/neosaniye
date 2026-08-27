import fs from 'node:fs';
import sharp from 'sharp';
const S = '/tmp/claude-0/-home-user-neosaniye/06d260fe-0ac4-5b60-a721-2622b642b579/scratchpad';
const ep = process.argv[2];
const files = fs.readdirSync(`${S}/vid`).filter((f) => f.endsWith('.png')).sort();
const CW = 216, CH = 384, COLS = 7;
const comps = [];
for (const [i, f] of files.entries()) {
  const buf = await sharp(`${S}/vid/${f}`).resize(CW, CH).png().toBuffer();
  comps.push({input: buf, left: (i % COLS) * CW, top: Math.floor(i / COLS) * CH});
}
await sharp({create: {width: CW * COLS, height: CH * Math.ceil(files.length / COLS), channels: 3, background: '#000'}})
  .composite(comps).png().toFile(`${S}/${ep}-video.png`);
console.log(`${files.length} frames -> ${S}/${ep}-video.png`);
