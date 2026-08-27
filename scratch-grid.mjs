import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ep = process.argv[2];
const perGrid = Number(process.argv[3] || 6);
const CELL_W = 250;
const CELL_H = Math.round(CELL_W * 1920 / 1080);
const LABEL = 26;
const dir = `/home/user/neosaniye/out/.frames-${ep}`;
const outDir = '/tmp/claude-0/-home-user-neosaniye/06d260fe-0ac4-5b60-a721-2622b642b579/scratchpad/grids';
await fs.mkdir(outDir, {recursive: true});

const all = await fs.readdir(dir);
// Keep only the four-position stills from this run: name ends -0-, -33-, -66-, -94-
const byShot = new Map();
for (const f of all) {
  const m = /^(\d+)-(.+)-(0|33|66|94)-\.png$/.exec(f);
  if (!m) continue;
  const stat = await fs.stat(path.join(dir, f));
  const key = m[2];
  if (!byShot.has(key)) byShot.set(key, {order: Number(m[1]), pics: new Map(), mtime: 0});
  const e = byShot.get(key);
  const prev = e.pics.get(m[3]);
  if (!prev || stat.mtimeMs > prev.mtime) e.pics.set(m[3], {file: path.join(dir, f), mtime: stat.mtimeMs});
  e.mtime = Math.max(e.mtime, stat.mtimeMs);
  e.order = Math.min(e.order, Number(m[1]));
}
// Only shots that have all four positions (a complete run)
const shots = [...byShot.entries()].filter(([, v]) => v.pics.size === 4).sort((a, b) => a[1].order - b[1].order);
console.log(`${ep}: ${shots.length} complete shots`);

const svgLabel = (text, w) =>
  Buffer.from(`<svg width="${w}" height="${LABEL}"><rect width="${w}" height="${LABEL}" fill="#111"/><text x="6" y="18" font-family="monospace" font-size="15" fill="#fff">${text}</text></svg>`);

for (let g = 0; g * perGrid < shots.length; g += 1) {
  const slice = shots.slice(g * perGrid, (g + 1) * perGrid);
  const W = CELL_W * 4;
  const H = (CELL_H + LABEL) * slice.length;
  const composites = [];
  for (const [i, [name, v]] of slice.entries()) {
    const top = i * (CELL_H + LABEL);
    composites.push({input: svgLabel(`${String(v.order).padStart(2, '0')} ${name}   0% / 33% / 66% / 94%`, W), left: 0, top});
    for (const [j, at] of ['0', '33', '66', '94'].entries()) {
      const buf = await sharp(v.pics.get(at).file).resize(CELL_W, CELL_H).png().toBuffer();
      composites.push({input: buf, left: j * CELL_W, top: top + LABEL});
    }
  }
  const out = `${outDir}/${ep}-${g}.png`;
  await sharp({create: {width: W, height: H, channels: 3, background: '#000'}}).composite(composites).png().toFile(out);
  console.log(out);
}
