#!/usr/bin/env node
/**
 * A CONTACT SHEET OF AN EPISODE'S CUT-OUTS, ON A CHECKERBOARD.
 *
 * Written after three attempts to catch bad artwork with statistics. The
 * measurable failures are covered — nothing keyed, everything keyed, a picture
 * shattered into unrelated pieces — and they earn their place. But the ones
 * that keep getting through are not measurable at that price:
 *
 *   a tonal step in the backdrop leaves a SLAB around the subject, and it
 *   survives precisely BECAUSE it differs from the border colour the check
 *   would compare it against;
 *
 *   and the model draws a lion when it was asked for a camel, which no pixel
 *   statistic will ever notice.
 *
 * A fourth guard would not catch those. It would only add code that looks like
 * safety. So the answer is not another threshold — it is to make LOOKING cost
 * ten seconds:
 *
 *   npm run assets:review -- --episode=mansa-musa
 *
 * The checkerboard is the point. Transparency is invisible against white and
 * against black, so a leftover grey slab reads as "background" on either — and
 * on a magenta check it is instantly, unmistakably wrong.
 */
import {readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT, episodeDir, parseArgs} from './lib/episode.mjs';
import {islandCount} from './generate-assets.mjs';

const CELL = 260;
const COLS = 5;

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/review-assets.mjs --episode=<episode-id> [--out=path.png]');
    process.exit(1);
  }

  const dir = path.join(episodeDir(episodeId), 'assets');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();

  const cutouts = [];
  for (const file of files) {
    const image = sharp(path.join(dir, file));
    if (!(await image.metadata()).hasAlpha) continue;
    const {data, info} = await image.ensureAlpha().raw().toBuffer({resolveWithObject: true});
    let solid = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += info.channels) {
      total += 1;
      if (data[i] > 200) solid += 1;
    }
    // A fully opaque file has no cut-out in it; it is a backdrop or a photo.
    const opaque = solid / total;
    if (opaque > 0.985) continue;
    cutouts.push({file, opaque, info});
  }

  if (!cutouts.length) {
    console.log(`${episodeId}: no cut-outs to review.`);
    return;
  }

  const rows = Math.ceil(cutouts.length / COLS);
  const width = CELL * Math.min(COLS, cutouts.length);
  const height = CELL * rows;
  const board = Buffer.from(
    `<svg width="${width}" height="${height}">
       <defs><pattern id="c" width="24" height="24" patternUnits="userSpaceOnUse">
         <rect width="24" height="24" fill="#c8408a"/>
         <rect width="12" height="12" fill="#7a1f55"/>
         <rect x="12" y="12" width="12" height="12" fill="#7a1f55"/>
       </pattern></defs>
       <rect width="100%" height="100%" fill="url(#c)"/>
     </svg>`,
  );

  const tiles = [];
  for (const [index, cut] of cutouts.entries()) {
    tiles.push({
      input: await sharp(path.join(dir, cut.file))
        .resize(CELL - 16, CELL - 16, {fit: 'inside'})
        .png()
        .toBuffer(),
      left: (index % COLS) * CELL + 8,
      top: Math.floor(index / COLS) * CELL + 8,
    });
  }

  const out = path.resolve(typeof args.out === 'string' ? args.out : path.join(ROOT, 'out', `${episodeId}-cutouts.png`));
  await writeFile(out, await sharp(board).composite(tiles).png().toBuffer());

  console.log(`${episodeId} — ${cutouts.length} cut-out(s):`);
  for (const cut of cutouts) {
    const islands = await islandCount(await sharp(path.join(dir, cut.file)).png().toBuffer());
    console.log(
      `  ${cut.file.padEnd(34)} ${String(cut.info.width).padStart(5)}x${String(cut.info.height).padEnd(5)}` +
        ` opaque ${(cut.opaque * 100).toFixed(1).padStart(5)}%  islands ${islands}`,
    );
  }
  console.log(`\n→ ${path.relative(ROOT, out)}  — open it. The numbers cannot tell you it drew a lion.`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
